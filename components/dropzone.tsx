export default function DropZoneUI({
  isDragActive,
}: {
  isDragActive: boolean;
}) {
  return (
    <div className="cursor-pointer py-12 border-dashed border-2 flex flex-col items-center justify-center rounded-md transition-colors duration-200 hover:border-blue-400">
      <div className="text-center space-y-4">
        <p className="text-lg font-medium">
          {isDragActive ? "🫳🏾 Drop PDF here" : "📄 Upload PDF files"}
        </p>
        <div className="text-sm text-gray-500 space-y-1 px-4">
          <p>
            Click <span className="underline">here</span> or drag files
          </p>
          <p className="text-xs">
            Supports PDF files only • Max 5MB per file • Up to 3 files
          </p>
        </div>
      </div>
    </div>
  );
}
