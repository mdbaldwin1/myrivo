import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type LegalMarkdownProps = {
  content: string;
};

export function LegalMarkdown({ content }: LegalMarkdownProps) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-6 text-2xl font-semibold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-5 text-xl font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-4 text-lg font-semibold">{children}</h3>,
          p: ({ children }) => <p className="mt-3 text-sm leading-7 text-muted-foreground">{children}</p>,
          ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          hr: () => <hr className="my-5 border-border/60" />,
          a: ({ href, children }) => (
            <a href={href} className="text-primary underline underline-offset-4 hover:opacity-80">
              {children}
            </a>
          ),
          blockquote: ({ children }) => <blockquote className="mt-3 border-l-2 border-border pl-4 italic text-muted-foreground">{children}</blockquote>,
          code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{children}</code>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
