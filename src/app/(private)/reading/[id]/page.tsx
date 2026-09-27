import { BookDetail } from "@/features/reading";

export const metadata = { title: "Book notes" };

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookDetail key={id} bookId={id} />;
}
