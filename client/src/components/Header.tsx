type HeaderProps = {
  title: string;
};

export default function Header({ title }: HeaderProps) {
  return (
    <div className="rounded-3xl bg-white/40 p-5 shadow-sm backdrop-blur-md">
      <h1 className="text-3xl font-semibold text-slate-800">{title}</h1>
    </div>
  );
}