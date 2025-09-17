type AlertProps = {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose?: () => void;
};

export default function Alert({ message, type, onClose }: AlertProps) {
  const baseClasses = "p-4 rounded-md my-4 flex justify-between items-start";
  const typeClasses = {
    error: "bg-red-100 text-red-700",
    success: "bg-green-100 text-green-700",
    info: "bg-blue-100 text-blue-700",
  };

  if (!message) return null;

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`} role="alert">
      <p>{message}</p>
      {onClose && (
        <button onClick={onClose} className="ml-4 -mt-1 -mr-1 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-100 focus:ring-red-600">
          <span className="sr-only">Dismiss</span>
          {/* X icon */}
          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
