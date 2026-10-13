import { useTranslation } from "react-i18next";
import { SettingsFieldSchema } from "#/types/settings";
import { Typography } from "#/ui/typography";
import { resolveSchemaFieldDescription } from "#/utils/sdk-settings-field-metadata";

export function FieldHelp({ field }: { field: SettingsFieldSchema }) {
  const { t } = useTranslation("openhands");
  const description = resolveSchemaFieldDescription(
    t,
    field.key,
    field.description,
  );

  return (
    <>
      {description ? (
        <Typography.Paragraph className="text-tertiary-alt text-xs leading-5">
          {description}
        </Typography.Paragraph>
      ) : null}
    </>
  );
}
