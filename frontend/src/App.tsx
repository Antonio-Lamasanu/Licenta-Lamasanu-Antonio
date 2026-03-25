import LyricEditor from "./components/LyricEditor";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Rhymathic</h1>
      </header>
      <main>
        <LyricEditor />
      </main>
    </div>
  );
}
