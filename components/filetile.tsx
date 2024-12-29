import { DocumentIcon, XMarkIcon } from "@heroicons/react/24/solid";

interface FileTileProps {
  filename: string;
  filesize: number;
  onDelete?: (file: string) => void;
}

export default function FileTile({
  filename,
  filesize,
  onDelete,
}: FileTileProps) {
  return (
    <div className="w-full flex items-center justify-between p-2 rounded-md border shadow-sm">
      <div className="flex items-center space-x-4">
        <div>
          <DocumentIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm">{filename}</p>
        </div>
        <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
          {Math.round((filesize / (1024 * 1024)) * 100) / 100} MB
        </span>
      </div>
      <div className="flex items-center space-x-2">
        {onDelete && (
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={() => onDelete(filename)}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
