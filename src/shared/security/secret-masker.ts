export function maskConnectionString(value: string): string {
  return value.replace(
    /(Password|Pwd|User ID|Uid|AccountKey|Secret|Token)\s*=\s*[^;'"]+/gi,
    (_, key) => `${key}=***`,
  );
}

export function maskSecretsInText(text: string): string {
  return text
    .replace(/(Password|Pwd)\s*=\s*[^;'"]+/gi, "$1=***")
    .replace(/(AccountKey|Secret|Token)\s*=\s*[^;'"]+/gi, "$1=***");
}
