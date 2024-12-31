import NavLinks from "@/components/navigation/navlinks";
import { createClient } from "@/utils/supabase/server";

export default async function Navigation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <div className="flex flex-row">
      <div className="flex grow justify-between gap-6">
        {user !== null ? <NavLinks /> : <></>}
      </div>
    </div>
  );
}
