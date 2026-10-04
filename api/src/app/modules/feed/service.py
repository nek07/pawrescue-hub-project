"""Лента: истории, «Нужна помощь», обновления от куратора, комментарии и лайки.

Кто что может публиковать:
- обновление о питомце — только его куратор;
- «Нужна помощь» — приют (от его имени) или проверенный волонтёр;
- историю — куратор или новый хозяин, забравший питомца через платформу.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.core.pagination import Page, PageQuery
from app.modules.applications.service import ApplicationService
from app.modules.feed.models import (
    Comment,
    CommentLike,
    PhotoLabel,
    Post,
    PostAuthorType,
    PostKind,
    PostLike,
    PostPhoto,
)
from app.modules.feed.repository import FeedRepository
from app.modules.feed.schemas import (
    AuthorOut,
    CommentCreate,
    CommentOut,
    LikeOut,
    PostCreate,
    PostFilters,
    PostOut,
    PostPhotoOut,
)
from app.modules.pets.service import PetService
from app.modules.shelters.models import Shelter
from app.modules.shelters.service import ShelterService
from app.modules.users.models import User, UserRole
from app.modules.users.service import UserService


def _forbidden(message: str) -> DomainError:
    return DomainError("post_forbidden", status=403, message=message)


def _post_not_found() -> DomainError:
    return DomainError("post_not_found", status=404, message="Post not found")


def _comment_not_found() -> DomainError:
    return DomainError("comment_not_found", status=404, message="Comment not found")


def _photo_out(photo: PostPhoto) -> PostPhotoOut:
    return PostPhotoOut(
        id=photo.id,
        url=photo.url,
        card_url=photo.card_url or photo.url,
        original_url=photo.original_url or photo.url,
        label=photo.label,
        caption=photo.caption,
    )


def _shelter_author(shelter: Shelter) -> AuthorOut:
    return AuthorOut(
        type="shelter",
        id=shelter.id,
        name=shelter.name,
        avatar_url=shelter.avatar_url,
        verified=shelter.verified_at is not None,
        city=shelter.city,
    )


def _is_verified_volunteer(user: User) -> bool:
    return user.role == UserRole.VOLUNTEER and user.verified_at is not None


class FeedService:
    def __init__(
        self,
        session: AsyncSession,
        repo: FeedRepository,
        pets: PetService,
        shelters: ShelterService,
        users: UserService,
        applications: ApplicationService,
    ) -> None:
        self.session, self.repo, self.pets = session, repo, pets
        self.shelters, self.users, self.applications = shelters, users, applications

    # --- посты

    async def list_posts(self, f: PostFilters, viewer: User | None) -> Page[PostOut]:
        posts, next_cursor, total = await self.repo.page_posts(f, f.page())
        return Page(
            items=await self._post_outs(posts, viewer), next_cursor=next_cursor, total=total
        )

    async def get_post(self, post_id: UUID, viewer: User | None) -> PostOut:
        post = await self.repo.get_post(post_id)
        if post is None:
            raise _post_not_found()
        return (await self._post_outs([post], viewer))[0]

    async def create_post(self, user: User, data: PostCreate) -> PostOut:
        pet = await self.pets.get_pet(data.pet_id) if data.pet_id else None
        is_curator = pet is not None and await self.pets.is_curator(pet, user.id)

        shelter_id = data.shelter_id
        if shelter_id is not None:
            if not await self.shelters.is_member(shelter_id, user.id):
                raise _forbidden("Only shelter staff can post on its behalf")
            if pet is not None and pet.shelter_id != shelter_id:
                raise _forbidden("The pet belongs to another curator")
            author_type = PostAuthorType.SHELTER
        elif pet is not None and pet.shelter_id is not None and is_curator:
            shelter_id, author_type = pet.shelter_id, PostAuthorType.SHELTER
        elif _is_verified_volunteer(user):
            author_type = PostAuthorType.VOLUNTEER
        else:
            author_type = PostAuthorType.OWNER

        if data.kind == PostKind.UPDATE and not is_curator:
            raise _forbidden("Only the curator posts updates about a pet")
        if data.kind == PostKind.HELP and (
            author_type == PostAuthorType.OWNER or (pet is not None and not is_curator)
        ):
            raise _forbidden("Only shelters and verified volunteers ask for help")
        if data.kind == PostKind.STORY and author_type == PostAuthorType.OWNER:
            # Новый хозяин рассказывает о своём питомце, забранном через платформу.
            if pet is None or not await self.applications.has_adopted(pet.id, user.id):
                raise _forbidden("Stories are for pets adopted through the platform")
        elif data.kind == PostKind.STORY and pet is not None and not is_curator:
            raise _forbidden("The pet belongs to another curator")

        post = await self.repo.create_post(
            author_id=user.id,
            author_type=author_type,
            shelter_id=shelter_id,
            pet_id=pet.id if pet else None,
            kind=data.kind,
            title=data.title.strip() if data.title else None,
            body=data.body,
        )
        await self.session.commit()
        return (await self._post_outs([post], user))[0]

    async def delete_post(self, post_id: UUID, user: User) -> None:
        post = await self.get_editable_post(post_id, user.id)
        await self.repo.delete_post(post)
        await self.session.commit()

    async def get_editable_post(self, post_id: UUID, user_id: UUID) -> Post:
        """Пост, который человек может менять: свой или своего приюта. Для media тоже."""
        post = await self.repo.get_post(post_id)
        if post is None:
            raise _post_not_found()
        if post.author_id != user_id and not (
            post.shelter_id and await self.shelters.is_member(post.shelter_id, user_id)
        ):
            raise _forbidden("Only the author can change this post")
        return post

    async def like_post(self, post_id: UUID, user: User, *, liked: bool) -> LikeOut:
        if await self.repo.get_post(post_id) is None:
            raise _post_not_found()
        await self.repo.set_like(PostLike, post_id, user.id, liked)
        await self.session.commit()
        counts = await self.repo.like_counts(PostLike, [post_id])
        return LikeOut(liked=liked, likes_count=counts.get(post_id, 0))

    # --- фото поста (для media)

    async def add_photo(
        self,
        post_id: UUID,
        *,
        url: str,
        card_url: str,
        original_url: str,
        label: PhotoLabel | None,
        caption: str | None,
    ) -> PostPhotoOut:
        """Транзакцию коммитит вызывающий (воркер фото)."""
        photo = await self.repo.add_photo(
            post_id,
            url=url,
            card_url=card_url,
            original_url=original_url,
            label=label,
            caption=caption,
        )
        return _photo_out(photo)

    async def get_photo(self, photo_id: UUID) -> PostPhotoOut | None:
        photo = await self.repo.get_photo(photo_id)
        return _photo_out(photo) if photo else None

    # --- комментарии

    async def list_comments(
        self, post_id: UUID, viewer: User | None, q: PageQuery
    ) -> Page[CommentOut]:
        if await self.repo.get_post(post_id) is None:
            raise _post_not_found()
        top, next_cursor, total = await self.repo.comments_page(post_id, q.page())
        replies = await self.repo.replies([c.id for c in top])
        outs = await self._comment_outs(top + [r for rs in replies.values() for r in rs], viewer)
        items = [
            outs[c.id].model_copy(update={"replies": [outs[r.id] for r in replies.get(c.id, [])]})
            for c in top
        ]
        return Page(items=items, next_cursor=next_cursor, total=total)

    async def add_comment(self, post_id: UUID, user: User, data: CommentCreate) -> CommentOut:
        post = await self.repo.get_post(post_id)
        if post is None:
            raise _post_not_found()
        if data.parent_id is not None:
            parent = await self.repo.get_comment(data.parent_id)
            if parent is None or parent.post_id != post.id:
                raise _comment_not_found()
            if parent.parent_id is not None:
                raise DomainError("reply_depth", status=409, message="Only one level of replies")
        shelter_id = None
        if data.as_shelter:
            if post.shelter_id is None or not await self.shelters.is_member(
                post.shelter_id, user.id
            ):
                raise _forbidden("Only the shelter's staff can reply on its behalf")
            shelter_id = post.shelter_id
        comment = await self.repo.add_comment(
            post_id=post.id,
            author_id=user.id,
            shelter_id=shelter_id,
            parent_id=data.parent_id,
            body=data.body,
        )
        await self.session.commit()
        return (await self._comment_outs([comment], user))[comment.id]

    async def delete_comment(self, comment_id: UUID, user: User) -> None:
        comment = await self.repo.get_comment(comment_id)
        if comment is None:
            raise _comment_not_found()
        if comment.author_id != user.id:
            raise DomainError("comment_forbidden", status=403, message="Only the author can delete")
        await self.repo.delete_comment(comment)
        await self.session.commit()

    async def like_comment(self, comment_id: UUID, user: User, *, liked: bool) -> LikeOut:
        if await self.repo.get_comment(comment_id) is None:
            raise _comment_not_found()
        await self.repo.set_like(CommentLike, comment_id, user.id, liked)
        await self.session.commit()
        counts = await self.repo.like_counts(CommentLike, [comment_id])
        return LikeOut(liked=liked, likes_count=counts.get(comment_id, 0))

    # --- сборка ответа

    async def _post_outs(self, posts: list[Post], viewer: User | None) -> list[PostOut]:
        if not posts:
            return []
        ids = [p.id for p in posts]
        viewer_id = viewer.id if viewer else None
        shelters = await self.shelters.get_shelters({p.shelter_id for p in posts if p.shelter_id})
        users = await self.users.get_users({p.author_id for p in posts if not p.shelter_id})
        cards = await self.pets.get_cards({p.pet_id for p in posts if p.pet_id})
        photos = await self.repo.photos(ids)
        likes = await self.repo.like_counts(PostLike, ids)
        liked = await self.repo.liked_by(PostLike, ids, viewer_id)
        comment_counts = await self.repo.comment_counts(ids)
        previews = await self.repo.comments_preview(ids)
        preview_outs = await self._comment_outs([c for cs in previews.values() for c in cs], viewer)

        result = []
        for p in posts:
            if p.shelter_id:
                author = _shelter_author(shelters[p.shelter_id])
            else:
                u = users[p.author_id]
                author = AuthorOut(
                    type="volunteer" if p.author_type == PostAuthorType.VOLUNTEER else "owner",
                    id=u.id,
                    name=u.name,
                    avatar_url=u.avatar_url,
                    verified=_is_verified_volunteer(u),
                    city=u.city,
                )
            result.append(
                PostOut(
                    id=p.id,
                    kind=p.kind,
                    author=author,
                    title=p.title,
                    body=p.body,
                    pet=cards.get(p.pet_id) if p.pet_id else None,
                    photos=[_photo_out(ph) for ph in photos.get(p.id, [])],
                    likes_count=likes.get(p.id, 0),
                    comments_count=comment_counts.get(p.id, 0),
                    liked_by_me=p.id in liked,
                    comments_preview=[preview_outs[c.id] for c in previews.get(p.id, [])],
                    created_at=p.created_at,
                )
            )
        return result

    async def _comment_outs(
        self, comments: list[Comment], viewer: User | None
    ) -> dict[UUID, CommentOut]:
        if not comments:
            return {}
        ids = [c.id for c in comments]
        shelters = await self.shelters.get_shelters(
            {c.shelter_id for c in comments if c.shelter_id}
        )
        users = await self.users.get_users({c.author_id for c in comments if not c.shelter_id})
        likes = await self.repo.like_counts(CommentLike, ids)
        liked = await self.repo.liked_by(CommentLike, ids, viewer.id if viewer else None)
        result: dict[UUID, CommentOut] = {}
        for c in comments:
            if c.shelter_id:
                author = _shelter_author(shelters[c.shelter_id])
            else:
                u = users[c.author_id]
                author = AuthorOut(
                    type="volunteer" if _is_verified_volunteer(u) else "user",
                    id=u.id,
                    name=u.name,
                    avatar_url=u.avatar_url,
                    verified=_is_verified_volunteer(u),
                    city=u.city,
                )
            result[c.id] = CommentOut(
                id=c.id,
                post_id=c.post_id,
                parent_id=c.parent_id,
                author=author,
                body=c.body,
                likes_count=likes.get(c.id, 0),
                liked_by_me=c.id in liked,
                created_at=c.created_at,
            )
        return result
