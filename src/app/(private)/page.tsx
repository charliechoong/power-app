import Link from "next/link";
import { Icon } from "@/components/icon";
import { getDailyQuote } from "@/features/home/daily-quote";
import { DailyQuoteRefresh } from "@/features/home/daily-quote-refresh";
import "@/features/home/home.css";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

const sections = [
  {
    href: "/reflections",
    name: "Reflections",
    icon: "spark" as const,
    description: "Thoughts and quotes worth returning to.",
    action: "Explore reflections",
  },
  {
    href: "/reading",
    name: "Reading list",
    icon: "book" as const,
    description: "Books in progress, and what they taught you.",
    action: "Open bookshelf",
  },
  {
    href: "/gratitude",
    name: "Gratitude",
    icon: "heart" as const,
    description: "Experiences you are glad to remember.",
    action: "Read gratitude",
  },
];

export default function HomePage() {
  const quote = getDailyQuote(new Date());

  return (
    <div className="home-page">
      <DailyQuoteRefresh />
      <header className="home-intro">
        <p className="eyebrow">A PERSONAL COLLECTION</p>
        <h1>Make space for what matters.</h1>
        <p>Thoughts, books, and moments to come back to.</p>
      </header>

      <section className="daily-quote" aria-labelledby="daily-quote-heading">
        <div className="daily-quote-topline">
          <span id="daily-quote-heading">TODAY&apos;S QUOTE</span>
          <time>{quote.date}</time>
        </div>
        <div className="daily-quote-mark" aria-hidden="true">
          <Icon name="quote" size={33} />
        </div>
        <blockquote>{quote.text}</blockquote>
        <aside
          className="daily-reflection-prompt"
          aria-label="Reflection prompt"
        >
          <p className="eyebrow">A QUESTION TO SIT WITH</p>
          <p>{quote.prompt}</p>
        </aside>
        <div className="daily-quote-footline">
          <span>Original words for the day ahead</span>
          <span>Changes daily · Singapore time</span>
        </div>
      </section>

      <section
        className="home-collections"
        aria-labelledby="home-collections-heading"
      >
        <div className="home-collections-heading">
          <div>
            <p className="eyebrow">EXPLORE THE COLLECTION</p>
            <h2 id="home-collections-heading">Find your way in.</h2>
          </div>
          <p>Take a moment with whatever speaks to you today.</p>
        </div>
        <div className="home-collection-grid">
          {sections.map((section) => (
            <Link
              className="home-collection-card"
              href={section.href}
              key={section.href}
            >
              <span className="home-collection-icon">
                <Icon name={section.icon} size={25} />
              </span>
              <h3>{section.name}</h3>
              <p>{section.description}</p>
              <span className="home-collection-action">
                {section.action} <Icon name="arrow" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
