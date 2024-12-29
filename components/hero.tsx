import Link from "next/link";

export default function Hero() {
  return (
    <div className="flex flex-col gap-8 items-center">
      <p className="text-5xl !leading-tight mx-auto max-w-xl text-center font-bold text-4xl">
        Microlearning made easy ⚡️
      </p>
      <p className="text-md mx-auto text-center">
        Trouble reading long form content? <br />
        No problem! Learn anything in 4 easy steps.
      </p>
      <div className="flex flex-col gap-2">
        <p className="w-full flex flex-row justify-start text-lg mx-auto max-w-md font-bold">
          👉🏾 Step 1
        </p>
        <p className="text-md mx-auto max-w-md">
          Share what you want to learn! Upload PDFs, text, images, or URLs
          (video support coming soon).
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="w-full flex flex-row justify-start text-lg mx-auto max-w-md font-bold">
          👉🏾 Step 2
        </p>
        <p className="text-md mx-auto max-w-md">
          Choose how often you’d like to receive text messages and decide if
          you'd like the information to repeat for better retention.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="w-full flex flex-row justify-start text-lg mx-auto max-w-md font-bold">
          👉🏾 Step 3
        </p>
        <p className="text-md mx-auto max-w-md">
          Hit submit, and we’ll transform your content into bite-sized,
          digestible text messages tailored to your schedule.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="w-full flex flex-row justify-start text-lg mx-auto max-w-md font-bold">
          👉🏾 Step 4
        </p>
        <p className="text-md mx-auto max-w-md">
          Stay informed and retain knowledge with easy-to-read, perfectly timed
          messages sent straight to your phone.
        </p>
      </div>
      <Link
        href="/create"
        className="opacity-100 bg-white rounded-md text-black py-2 px-4 text-center cursor-pointer hover:bg-black hover:text-white hover:border-white border-2"
      >
        Get Started
      </Link>
    </div>
  );
}
