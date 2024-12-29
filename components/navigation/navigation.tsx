import NavLinks from "@/components/navigation/navlinks";

export default function Navigation() {
  return (
    <div className="flex flex-row">
      <div className="flex grow justify-between gap-6">
        <NavLinks />
      </div>
    </div>
  );
}
