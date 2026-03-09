import { AppAlert } from "@/components/ui/app-alert";

type FeedbackMessageProps = {
  type: "error" | "success";
  message: string | null;
  className?: string;
};

export function FeedbackMessage({ type, message, className }: FeedbackMessageProps) {
  return <AppAlert variant={type === "error" ? "error" : "success"} compact message={message} className={className} />;
}
