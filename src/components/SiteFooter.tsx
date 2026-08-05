export const SiteFooter = () => {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
        <span className="text-xl font-bold tracking-tight text-foreground">Home</span>
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} captions.io. Made for Desi creators.
        </p>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Terms</a>
          <a href="#" className="hover:text-foreground">Contact</a>
        </div>
      </div>
    </footer>
  );
};
