type SupabaseQueryError = {
  code?: string;
  message?: string;
} | null;

export function isMissingRelationInSchemaCache(error: SupabaseQueryError) {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST205") {
    return true;
  }

  const message = error.message?.toLowerCase() ?? "";
  return message.includes("could not find the table") || message.includes("schema cache");
}

export function isMissingColumnInSchemaCache(error: SupabaseQueryError, columnName: string) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  const normalizedColumn = columnName.trim().toLowerCase();

  if (!normalizedColumn) {
    return false;
  }

  const mentionsColumn =
    message.includes(normalizedColumn) ||
    message.includes(`.${normalizedColumn}`) ||
    message.includes(`_${normalizedColumn}`);

  return (
    mentionsColumn &&
    (
      (message.includes("schema cache") && message.includes("could not find") && message.includes("column")) ||
      (message.includes("column") && message.includes("does not exist"))
    )
  );
}
