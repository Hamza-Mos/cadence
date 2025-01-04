import Link from "next/link";

export default async function Done() {
  return (
    <div className="flex flex-col gap-8 items-center">
      <div className="flex flex-row justify-around w-full text-lg text-center">
        <h1>Done! We are processing your submission 😁</h1>
      </div>
      <div className="flex flex-row justify-around w-full">
        <Link
          href="/create"
          className="opacity-100 bg-white rounded-md text-black py-2 px-4 text-center cursor-pointer hover:bg-black hover:text-white hover:border-white border-2"
        >
          Submit Another
        </Link>
      </div>
    </div>
  );
}
