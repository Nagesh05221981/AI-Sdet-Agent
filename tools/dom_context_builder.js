export function extractRelevantDom(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .slice(0, 20000); // prevent token overflow
}