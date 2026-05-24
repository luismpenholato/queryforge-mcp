export function getDefaultCsharpVersion(targetFramework: string): string {
  const tf = targetFramework.toLowerCase();

  if (tf.startsWith("netcoreapp2.1")) return "7.3";
  if (tf.startsWith("netcoreapp2.2")) return "7.3";
  if (tf.startsWith("netcoreapp3.1")) return "8.0";
  if (tf.startsWith("net5")) return "9.0";
  if (tf.startsWith("net6")) return "10.0";
  if (tf.startsWith("net7")) return "11.0";
  if (tf.startsWith("net8")) return "12.0";
  if (tf.startsWith("net9")) return "13.0";
  if (tf.startsWith("net10")) return "14.0";

  if (tf.startsWith("net4")) return "7.3";

  return "unknown";
}

export function isCsharpFeatureSupported(
  langVersion: string,
  feature: "records" | "switch-expressions" | "nullable-reference-types",
): boolean {
  if (langVersion === "unknown") return false;

  const version = parseFloat(langVersion);
  if (Number.isNaN(version)) return false;

  switch (feature) {
    case "records":
      return version >= 9;
    case "switch-expressions":
      return version >= 8;
    case "nullable-reference-types":
      return version >= 8;
    default:
      return false;
  }
}
