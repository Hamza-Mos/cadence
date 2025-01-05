import Link from "next/link";

export default function Hero() {
  return (
    <div className="flex flex-col gap-8 items-center">
      <p className="text-5xl !leading-tight mx-auto max-w-2xl text-center font-bold text-3xl md:text-4xl">
        Microlearning made easy ⚡️
      </p>
      <p className="text-md mx-auto text-center">
        Trouble reading long form content? <br />
        No problem! Absorb any information in 4 easy steps.
      </p>
      <Link
        href="/create"
        className="opacity-100 bg-white rounded-md text-black py-2 px-4 text-center cursor-pointer hover:bg-black hover:text-white hover:border-white border-2"
      >
        Get Started
      </Link>
      <br />
      <div className="flex flex-col gap-2">
        <div className="text-2xl md:text-3xl font-bold text-center p-2">
          Why Cadence?
        </div>
        <p className="w-full flex flex-row justify-start text-md mx-auto max-w-md">
        Ever open your inbox to find a newsletter you’re excited to read or a blog post that has an appealing title, but then get swamped with everything else and forget about it?  <br />  <br /> You tell yourself you'll get back to it later, but weeks go by and it’s still sitting there, unopened in a tab in your browser. <br />  <br /> You’re not alone.  <br />  <br /> Long-form content can be tough to tackle—it takes time, focus, and energy. <br />  <br />  That’s exactly why we created Cadence.  <br />  <br /> Cadence breaks down knowledge into bite-sized, digestible pieces, making it easier to stay on top of the information that matters.
        </p>
      </div>
      <br />
      <div className="flex flex-col gap-2">
        <div className="text-2xl md:text-3xl font-bold text-center p-2">
          How Cadence Works?
        </div>
        <p className="w-full flex flex-row justify-start text-md md:text-lg mx-auto max-w-md font-bold">
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
      <br />
      <div className="flex flex-col gap-2">
        <div className="text-2xl md:text-3xl font-bold text-center p-2">
          Pricing
        </div>
        <section className="py-8 sm:py-16">
          <div className="container mx-auto px-6 text-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Free Plan */}
              <div className="shadow-lg rounded-lg p-6 border-2 border-gray-500">
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">
                  Free
                </h3>
                <p className="text-gray-500 mb-6">
                  Try Cadence to help you microlearn.
                </p>
                <p className="text-4xl font-bold mb-6">
                  $0<span className="text-lg">/month</span>
                </p>
                <ul className="text-left mb-6">
                  <li className="mb-2">✔ Up to 7 submissions</li>
                  <li className="mb-2">✔ One text per day</li>
                  <li className="mb-2">✔ Priority Support</li>
                </ul>
              </div>

              {/* Pro Plan */}
              <div className="shadow-lg rounded-lg p-6 border-2 border-yellow-500">
                <h3 className="text-2xl md:text-3xl font-semibold mb-4">
                  Pro ✨
                </h3>
                <p className="text-gray-500 mb-6">Never forget a thing!</p>
                <p className="text-4xl font-bold mb-6">
                  $4.99<span className="text-lg">/month</span>
                </p>
                <ul className="text-left mb-6">
                  <li className="mb-2">✔ Unlimited submissions</li>
                  <li className="mb-2">
                    ✔ One text every day, 12 hours, 6 hours or 1 hour
                  </li>
                  <li className="mb-2">
                    ✔ Repeat information over time for better retention
                  </li>
                  <li className="mb-2">✔ Priority Support</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
