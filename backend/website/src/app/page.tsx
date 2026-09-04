export default function Home() {
  return (
    <main className="min-h-screen">
      {/* ========== HERO SECTION ========== */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-blue-900 mb-4">
          🏥 Medsathu.inn
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-6 max-w-3xl mx-auto">
          All-in-One Medical Learning Platform for MBBS Students &amp; Teachers
        </p>
        <p className="text-lg text-gray-500 mb-8">
          Video Lectures • 20K+ QBank • AI Tutor • Flashcards • Notes • Community
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="/login"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
          >
            Login
          </a>
          <a
            href="/register"
            className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition"
          >
            Sign Up Free
          </a>
        </div>

        {/* Free Trial Badge */}
        <p className="mt-4 text-sm text-gray-500">
          🎓 Start with <span className="font-bold text-blue-600">10 Free Lectures</span> — No credit card required
        </p>
      </section>

      {/* ========== FEATURES GRID ========== */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-blue-900 mb-12">
            Everything You Need, All in One Place
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-blue-50 p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="text-xl font-semibold text-blue-900">20K+ QBank</h3>
              <p className="text-gray-600">Practice with video solutions &amp; performance analytics</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-blue-50 p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-3">🎥</div>
              <h3 className="text-xl font-semibold text-blue-900">Video Lectures</h3>
              <p className="text-gray-600">High-quality recorded &amp; live classes by expert faculty</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-blue-50 p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-3">🧠</div>
              <h3 className="text-xl font-semibold text-blue-900">AI Tutor</h3>
              <p className="text-gray-600">24/7 AI assistant for doubts, summaries &amp; flashcards</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-blue-50 p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-3">📝</div>
              <h3 className="text-xl font-semibold text-blue-900">Notes &amp; Library</h3>
              <p className="text-gray-600">Upload, share, annotate notes &amp; access medical textbooks</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-blue-50 p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="text-xl font-semibold text-blue-900">Study Planner</h3>
              <p className="text-gray-600">To-do lists, reminders, progress tracking &amp; exam countdown</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-blue-50 p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="text-4xl mb-3">👥</div>
              <h3 className="text-xl font-semibold text-blue-900">Community &amp; Social</h3>
              <p className="text-gray-600">Find friends by user ID, connect with university peers, share photos</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SUBSCRIPTION PLANS ========== */}
      <section className="py-16 bg-gradient-to-b from-white to-blue-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-blue-900 mb-4">
            Choose Your Plan
          </h2>
          <p className="text-gray-600 mb-10">
            Start free, upgrade anytime. All payments go directly to your bank account.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white p-6 rounded-xl shadow-md border-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-700">Free</h3>
              <p className="text-3xl font-bold text-gray-800 my-3">₹0</p>
              <ul className="text-left text-gray-600 space-y-2 mb-6">
                <li>✅ 10 Free Lectures</li>
                <li>✅ Notes Upload</li>
                <li>✅ Community Access</li>
                <li>❌ Full QBank</li>
                <li>❌ AI Tutor</li>
                <li>❌ Offline Download</li>
              </ul>
              <a
                href="/register"
                className="block bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition"
              >
                Get Started
              </a>
            </div>

            {/* Monthly Plan */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-500 relative">
              <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm">
                Most Popular
              </span>
              <h3 className="text-xl font-bold text-blue-700">Monthly</h3>
              <p className="text-3xl font-bold text-blue-700 my-3">₹499</p>
              <ul className="text-left text-gray-600 space-y-2 mb-6">
                <li>✅ Unlimited Lectures</li>
                <li>✅ Full 20K+ QBank</li>
                <li>✅ AI Tutor</li>
                <li>✅ Flashcards (Anki-style)</li>
                <li>✅ Offline Download</li>
                <li>✅ Live Doubt Sessions</li>
              </ul>
              <a
                href="/subscribe"
                className="block bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Subscribe Now
              </a>
            </div>

            {/* Yearly Plan */}
            <div className="bg-white p-6 rounded-xl shadow-md border-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-700">Yearly</h3>
              <p className="text-3xl font-bold text-gray-800 my-3">₹4,999</p>
              <p className="text-sm text-green-600 -mt-2 mb-3">Save ₹989/year</p>
              <ul className="text-left text-gray-600 space-y-2 mb-6">
                <li>✅ Everything in Monthly</li>
                <li>✅ Advanced Analytics</li>
                <li>✅ Priority Support</li>
                <li>✅ Exclusive Webinars</li>
                <li>✅ Certificate of Completion</li>
              </ul>
              <a
                href="/subscribe"
                className="block bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
              >
                Subscribe Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-blue-900 text-white py-8 mt-10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg font-bold">🏥 Medsathu.inn</p>
          <p className="text-sm text-blue-300 mt-2">
            © {new Date().getFullYear()} Medsathu.inn — All-in-One Medical Learning Platform
          </p>
          <p className="text-xs text-blue-400 mt-1">
            Built with ❤️ for MBBS students &amp; teachers
          </p>
        </div>
      </footer>
    </main>
  );
}