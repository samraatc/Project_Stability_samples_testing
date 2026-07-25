import { useState, useRef, useEffect, useMemo } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface ComboboxProps {
  id?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Find currently selected option object
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(term)),
    );
  }, [options, searchTerm]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Control button / Display area */}
      <div
        id={id}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border transition duration-150 cursor-pointer ${
          disabled
            ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-within:ring-1 focus-within:ring-blue-500 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
      >
        <div className="truncate">
          {selectedOption ? (
            <span className="font-medium">
              {selectedOption.label}
              {selectedOption.subLabel && (
                <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  ({selectedOption.subLabel})
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </div>
        <span className="text-slate-400 text-[10px] pointer-events-none">{isOpen ? '▲' : '▼'}</span>
      </div>

      {/* Dropdown panel */}
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden animate-menu-fade">
          {/* Text Search Input inside dropdown */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="text"
              autoFocus
              placeholder="Search product by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Options List showing max 10 visible items (max-h-56 scrollable for remaining) */}
          <div className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-50 dark:divide-slate-700/30">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                No matching products found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="truncate">
                      <span className="font-medium">{opt.label}</span>
                      {opt.subLabel && (
                        <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          [{opt.subLabel}]
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
