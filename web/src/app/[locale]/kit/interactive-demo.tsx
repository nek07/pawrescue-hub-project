"use client";

import { useState } from "react";
import { Button, Chip } from "@/shared/ui";

export function ChipDemo() {
  const [pressed, setPressed] = useState<string[]>(["Ладит с детьми"]);
  const toggle = (label: string) =>
    setPressed((current) =>
      current.includes(label) ? current.filter((x) => x !== label) : [...current, label],
    );

  return (
    <div className="flex flex-wrap gap-2">
      {["Стерилизован", "Ладит с детьми", "Нужна передержка", "Зарарсыздандырылған"].map(
        (label) => (
          <Chip key={label} pressed={pressed.includes(label)} onClick={() => toggle(label)}>
            {label}
          </Chip>
        ),
      )}
    </div>
  );
}

export function LoadingDemo() {
  const [loading, setLoading] = useState(false);
  const submit = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <Button loading={loading} onClick={submit}>
      {loading ? "Отправляем…" : "Нажмите — загрузка 1,5 с"}
    </Button>
  );
}
