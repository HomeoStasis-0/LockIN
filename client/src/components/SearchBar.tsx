import { Search } from "lucide-react"

type SearchBarProps = {
    value: string
    onSearchChange: (value: string) => void;
    onSearchSubmit: () => void;
};

export default function SearchBar({value, onSearchChange, onSearchSubmit}: SearchBarProps) {
    return (
        <form onSubmit={(e) => {e.preventDefault(); onSearchSubmit();}}  className="w-full flex justify-center">
            <div className="flex w-full max-w-2xl items-center gap-3 rounded-full border border-slate-300 bg-white px-5 py-3 shadow-sm transition focus-within:border-blue-400 focus-within:shadow-md">
             <Search size={18} className="text-slate-500" />
             <input value={value} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search Public Decks" className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"/>
            </div>
        </form>
    );
}