export default function DropZoneUI({
  isDragActive,
}: {
  isDragActive: boolean;
}) {
  return (
    <div className="cursor-pointer py-20 border-dashed border-2 flex flex-row justify-around rounded-md">
      <div>
        <p className="flex flex-row justify-around ">
          {isDragActive ? "🫳🏾 Drop file" : "📁 Upload Any files"}
        </p>
        <br />
        <p className="flex flex-row text-sm px-4">
          Click&nbsp;<u>here</u>&nbsp;or drag files. Max file size 5MB.
        </p>
      </div>
    </div>
  );
}
