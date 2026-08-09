type FormEmbedProps = {
  filloutId?: string;
};

const FormEmbed = ({ filloutId }: FormEmbedProps) => {
  if (!filloutId) {
    return null;
  }

  return (
    <div id="apply-form" className="w-full">
      <iframe
        src={`https://forms.fillout.com/t/${filloutId}`}
        className="min-h-[600px] w-full border-0"
        title="Application Form"
      />
    </div>
  );
};

export { FormEmbed };
