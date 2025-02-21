interface NotConnectedProps {
  title?: string;
  message?: string;
}

export default function NotConnected({
  title = 'Connect your wallet',
  message = 'Please connect your wallet to continue.',
}: NotConnectedProps) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500">{message}</p>
    </div>
  );
} 