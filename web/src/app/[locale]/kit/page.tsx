import { FileText, MessageSquare, PawPrint } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@/shared/ui";
import { ChipDemo, LoadingDemo } from "./interactive-demo";

// Витрина UI-кита по листу «Состояния» макета. Только для разработки,
// поэтому тексты здесь не переводятся.
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="page-container flex flex-col gap-12 py-10">
      <header>
        <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
          Спецификация
        </p>
        <h1 className="font-display text-4xl font-semibold">Состояния, пустые экраны и ошибки</h1>
      </header>

      <Section title="Кнопки">
        <div className="grid gap-3 sm:grid-cols-[auto_repeat(3,minmax(0,1fr))] sm:items-center">
          <span />
          <Caption>Обычная</Caption>
          <Caption>Недоступна</Caption>
          <Caption>Загрузка</Caption>

          <Caption>Основная</Caption>
          <Button>Забрать домой</Button>
          <Button disabled>Забрать домой</Button>
          <Button loading>Отправляем…</Button>

          <Caption>Второстепенная</Caption>
          <Button variant="secondary">Читать истории</Button>
          <Button variant="secondary" disabled>
            Читать истории
          </Button>
          <Button variant="secondary" loading>
            Загружаем…
          </Button>

          <Caption>Призрачная</Caption>
          <Button variant="ghost">Отмена</Button>
          <Button variant="ghost" disabled>
            Отмена
          </Button>
          <Button variant="ghost" loading>
            Отменяем…
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LoadingDemo />
          <Button asChild variant="secondary">
            <a href="#kit-fields">Кнопка-ссылка (asChild)</a>
          </Button>
          <Button size="sm">Маленькая</Button>
          <Button size="lg">Большая</Button>
        </div>
        <Note>Наведение и фокус проверяйте мышью и клавишей Tab.</Note>
      </Section>

      <Section title="Поля ввода и чипы" id="kit-fields">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Телефон" hint="Его увидит куратор после одобрения">
            <Input placeholder="+7 ___ ___ __ __" inputMode="tel" />
          </Field>
          <Field label="Телефон" error="Номер неполный: нужно 11 цифр">
            <Input defaultValue="+7 701 23" inputMode="tel" />
          </Field>
          <Field label="Телефон">
            <Input defaultValue="+7 701 234 56 78" disabled />
          </Field>
          <Field label="Город">
            <Select defaultValue="pavlodar">
              <option value="pavlodar">Павлодар</option>
              <option value="astana">Астана</option>
              <option value="almaty">Алматы</option>
            </Select>
          </Field>
        </div>
        <Field
          label="Почему решили взять питомца?"
          hint="Необязательно, но очень помогает куратору"
        >
          <Textarea />
        </Field>
        <ChipDemo />
        <div className="flex flex-wrap gap-2">
          <Badge>Ищет дом</Badge>
          <Badge>Нужна передержка</Badge>
          <Badge>На лечении</Badge>
          <Badge tone="success">Нашёл дом</Badge>
          <Badge tone="inverse">Нужна помощь</Badge>
          <Badge tone="neutral">Черновик</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Avatar name="Асель" tone="ink" size="sm" />
          <Avatar name="Асель" />
          <Avatar name="" size="lg" />
        </div>
      </Section>

      <Section title="Пустые состояния">
        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState
            visual={<PawPrint aria-hidden className="size-8" />}
            title="Никого не нашли"
            description="Уберите часть фильтров или выберите другой город."
            action={<Button>Сбросить фильтры</Button>}
          />
          <EmptyState
            visual={<MessageSquare aria-hidden className="size-8" />}
            title="Пока нет сообщений"
            description="Напишите куратору со страницы питомца — переписка появится здесь."
            action={<Button variant="secondary">Перейти в каталог</Button>}
          />
          <EmptyState
            visual={<FileText aria-hidden className="size-8" />}
            title="У приюта ещё нет постов"
            description="Подпишитесь, чтобы увидеть первые истории в своей ленте."
            action={<Button variant="secondary">Подписаться</Button>}
          />
        </div>
      </Section>

      <Section title="Ошибки и загрузка">
        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState
            visual={<span className="font-display text-6xl text-primary">404</span>}
            title="Такой страницы нет"
            description="Возможно, питомца уже забрали домой и анкету сняли."
            action={<Button>К каталогу</Button>}
          />
          <Card className="p-4">
            <ErrorState
              title="Нет соединения"
              description="Сообщение не отправлено. Проверьте интернет — мы повторим автоматически."
              action={
                <Button variant="ghost" size="sm" className="px-0 underline">
                  Повторить сейчас
                </Button>
              }
            />
          </Card>
          <Card>
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-10 rounded-pill" />
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <span className="text-sm text-ink-muted">{children}</span>;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}
