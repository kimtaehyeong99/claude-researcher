import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({ node, ...props }) => (
            <figure className="paper-figure-inline">
              <img
                {...props}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const figure = target.closest('.paper-figure-inline');
                  if (figure) {
                    (figure as HTMLElement).style.display = 'none';
                  }
                }}
              />
              {props.alt && <figcaption>{props.alt}</figcaption>}
            </figure>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
