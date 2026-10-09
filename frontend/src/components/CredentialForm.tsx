'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { CredentialItemStatus, PinStatus, PinSaveResponse } from '../types';

interface CredentialCardProps {
  item: CredentialItemStatus;
  onSaved: (apiName: string) => void;
}

function PinCard() {
  const [pin, setPin] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res: PinStatus = await api.getPinStatus();
        setHasPin(res.has_pin);
      } catch {}
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      await api.setPin(pin);
      setMessage('PIN saved');
      setPin('');
      setHasPin(true);
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-gray-900 truncate">
              Transaction PIN
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                hasPin
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {hasPin ? 'Configured' : 'Not set'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Static PIN used for all transactions. Stored encrypted; never returned.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
            setMessage('');
            setError('');
          }}
          className="ml-4 shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {expanded ? 'Close' : hasPin ? 'Update' : 'Configure'}
        </button>
      </div>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="pin-input" className="block text-sm font-medium text-gray-700">
              PIN
            </label>
            <input
              id="pin-input"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              autoComplete="off"
              placeholder="Enter transaction PIN"
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save PIN'}
          </button>
        </form>
      )}
    </div>
  );
}

function CredentialCard({ item, onSaved }: CredentialCardProps) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      await api.saveCredentials(clientId, clientSecret, item.api_name);
      setMessage('Saved');
      setClientId('');
      setClientSecret('');
      onSaved(item.api_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {item.label}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                item.has_credentials
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {item.has_credentials ? 'Configured' : 'Not set'}
            </span>
          </div>
          {item.has_credentials && (
            <p className="mt-0.5 text-xs text-gray-500">
              ID: {item.client_id_masked}
              {item.saved_at ? ` • saved ${new Date(item.saved_at).toLocaleString()}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
            setMessage('');
            setError('');
          }}
          className="ml-4 shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {expanded ? 'Close' : item.has_credentials ? 'Update' : 'Configure'}
        </button>
      </div>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`client_id-${item.api_name}`}
                className="block text-sm font-medium text-gray-700"
              >
                API ID
              </label>
              <input
                id={`client_id-${item.api_name}`}
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                autoComplete="off"
                placeholder="Enter API ID"
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor={`client_secret-${item.api_name}`}
                className="block text-sm font-medium text-gray-700"
              >
                API Secret
              </label>
              <input
                id={`client_secret-${item.api_name}`}
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                required
                autoComplete="off"
                placeholder="Enter API Secret"
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Credentials'}
          </button>
        </form>
      )}
    </div>
  );
}

export function CredentialForm() {
  const [items, setItems] = useState<CredentialItemStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await api.getAllCredentialStatus();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaved = () => {
    load();
  };

  const configuredCount = items.filter((i) => i.has_credentials).length;

  return (
    <div className="bg-white p-6 rounded-lg shadow border">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900">
          API Configuration
        </h2>
        {items.length > 0 && (
          <span className="text-sm text-gray-500">
            {configuredCount}/{items.length} configured
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Each API requires its own credentials. Enter the API ID / Secret issued
        by your provider.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* PIN card (MVP2) */}
          <PinCard />

          {items.length > 0 && items.map((item) => (
            <CredentialCard key={item.api_name} item={item} onSaved={handleSaved} />
          ))}
          {items.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No credential types found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}