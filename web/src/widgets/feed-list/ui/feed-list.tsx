"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { MessageSquare, Newspaper } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { fetchPosts, PostCard, type FeedCategory, type Post, type PostPage } from "@/entities/post";
import { LikeButton } from "@/features/like-post";
import { ShareButton } from "@/features/share-pet";
import { StartChatButton } from "@/features/start-conversation";
import { Button, EmptyState, ErrorState } from "@/shared/ui";
import { PostComments } from "./post-comments";

type FeedQuery = { category?: FeedCategory; shelter_id?: string; pet_id?: string };

/**
 * Лента: первая страница приходит с сервера (initialData), следующие —
 * из браузера по курсору. TanStack Query держит страницы и повторы.
 */
export function FeedList({
  query,
  initialPage,
  signedIn,
}: {
  query: FeedQuery;
  initialPage: PostPage;
  signedIn: boolean;
}) {
  const t = useTranslations("feed");
  const feed = useInfiniteQuery({
    queryKey: ["posts", query],
    queryFn: ({ pageParam }) => fetchPosts(query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined] },
    // Свежая первая страница уже пришла с сервера
    staleTime: 60_000,
  });

  const posts = feed.data.pages.flatMap((page) => page.items);

  if (posts.length === 0) {
    return (
      <EmptyState
        visual={<Newspaper aria-hidden className="size-8" />}
        title={t("empty.title")}
        description={t("empty.text")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {posts.map((post) => (
          <li key={post.id}>
            <PostItem post={post} signedIn={signedIn} />
          </li>
        ))}
      </ul>
      {feed.isFetchNextPageError && (
        <ErrorState
          title={t("loadError")}
          action={
            <Button size="sm" variant="secondary" onClick={() => feed.fetchNextPage()}>
              {t("retry")}
            </Button>
          }
        />
      )}
      {feed.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={feed.isFetchingNextPage}
          onClick={() => feed.fetchNextPage()}
        >
          {feed.isFetchingNextPage ? t("loading") : t("showMore")}
        </Button>
      )}
    </div>
  );
}

function PostItem({ post, signedIn }: { post: Post; signedIn: boolean }) {
  const [comments, setComments] = useState(post.comments_count);
  return (
    <PostCard
      post={post}
      actions={<PostActions post={post} signedIn={signedIn} comments={comments} />}
      comments={
        <PostComments
          post={post}
          signedIn={signedIn}
          total={comments}
          onTotalChange={setComments}
        />
      }
    />
  );
}

function PostActions({
  post,
  signedIn,
  comments,
}: {
  post: Post;
  signedIn: boolean;
  comments: number;
}) {
  const t = useTranslations("feed");
  return (
    <>
      <LikeButton
        target="post"
        id={post.id}
        liked={post.liked_by_me}
        count={post.likes_count}
        signedIn={signedIn}
      />
      <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
        <MessageSquare aria-hidden className="size-4" />
        {t("comments", { count: comments })}
      </span>
      {post.kind === "help" &&
        (post.author.type === "shelter" || post.author.type === "volunteer") && (
          <StartChatButton
            target={
              post.author.type === "shelter"
                ? { shelter_id: post.author.id }
                : { volunteer_id: post.author.id }
            }
            signedIn={signedIn}
            size="sm"
            className="ml-auto"
          >
            {t("respond")}
          </StartChatButton>
        )}
      <ShareButton
        title={post.title ?? post.body.slice(0, 60)}
        className={post.kind === "help" ? undefined : "ml-auto"}
      />
    </>
  );
}
