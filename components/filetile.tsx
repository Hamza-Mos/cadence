import { DocumentIcon, XMarkIcon } from "@heroicons/react/24/solid";

interface FileTileProps {
  file: File;
  onDelete: (file: File) => void;
}

export default function FileTile({ file, onDelete }: FileTileProps) {
  return (
    <div className="w-full flex items-center justify-between p-2 rounded-md border border-gray-300 shadow-sm">
      <div className="flex items-center space-x-4">
        <div>
          <DocumentIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm">{file.name}</p>
        </div>
        <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
          {Math.round((file.size / (1024 * 1024)) * 100) / 100} MB
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <button
          className="text-gray-500 hover:text-gray-700"
          onClick={() => onDelete(file)}
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
