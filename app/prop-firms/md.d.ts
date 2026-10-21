// content/prop-firms/codes.md is bundled as plain text (next.config.js, asset/source).
declare module '*.md' {
  const text: string;
  export default text;
}
