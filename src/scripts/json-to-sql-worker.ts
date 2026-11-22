import { analyze, generateSql, type Options } from "../lib/json-to-sql";
export interface Task {
  revision: number;
  action: "analyze" | "generate";
  text: string;
  options: Options;
}
// Dedicated local module worker; no imports of UI dictionaries or network APIs.
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<Task>) => void) | null;
  postMessage: (message: unknown) => void;
};
workerScope.onmessage = ({ data }) => {
  const result =
    data.action === "generate"
      ? generateSql(data.text, data.options)
      : analyze(data.text, data.options);
  workerScope.postMessage({
    revision: data.revision,
    action: data.action,
    result,
  });
};
