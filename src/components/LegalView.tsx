import { motion } from 'framer-motion';
import { ChevronLeft, Shield, Scale, ArrowLeft } from 'lucide-react';

interface LegalViewProps {
  mode: 'privacy' | 'terms';
  onBack: () => void;
}

export function LegalView({ mode, onBack }: LegalViewProps) {
  const isPrivacy = mode === 'privacy';

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to home
          </button>
          <div className="flex items-center gap-2">
            {isPrivacy ? <Shield className="w-5 h-5 text-blue-600" /> : <Scale className="w-5 h-5 text-purple-600" />}
            <span className="text-sm font-bold uppercase tracking-widest text-gray-400">
              {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="prose prose-blue prose-img:rounded-xl max-w-none"
        >
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900 mb-8">
            {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
          </h1>
          
          <p className="text-lg text-gray-500 mb-12 border-b border-gray-100 pb-8">
            Last Updated: April 9, 2026. This document governs your use of the DocIntel platform and outlines our commitment to your data.
          </p>

          {isPrivacy ? (
            <div className="space-y-12">
              <section>
                <h2 className="text-2xl font-bold mb-4">1. Data Sovereignty & Isolation</h2>
                <p>
                  At DocIntel, we believe your data is yours alone. We utilize <strong>PostgreSQL Row Level Security (RLS)</strong> to ensure that every single document, chat message, and vector embedding is cryptographically isolated at the database level. No other user—nor our system administrators—can access your raw document content without your explicit sharing action.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">2. AI Processing & Intelligence</h2>
                <p>
                  DocIntel leverages state-of-the-art AI models, including <strong>Google Gemini 2.5 Pro</strong> and <strong>LlamaParse</strong>, to provide document intelligence. 
                </p>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-xl my-6">
                  <h4 className="font-bold text-blue-900 mb-2">The Zero-Training Guarantee</h4>
                  <p className="text-blue-800 text-sm m-0">
                    We strictly enforce that your uploaded documents and chat histories are <strong>never used to train</strong> base foundational models or internal DocIntel intelligence improvements. Your data is used exclusively to provide real-time inference for your specific workspace.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">3. Data Retention & Deletion</h2>
                <p>
                  You have full control over your digital footprint. When you delete a file from your DocIntel drive, we trigger a multi-stage purging process:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Metadata Removal:</strong> File references are immediately scrubbed from our database.</li>
                  <li><strong>Vector Flush:</strong> Semantic embeddings in our pgvector store are permanently deleted.</li>
                  <li><strong>Storage Purge:</strong> The raw file (PDF, Doc, Image) is removed from our encrypted S3-compatible buckets.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">4. Third-Party Services</h2>
                <p>
                  We partner with industry-leading infrastructure providers to deliver DocIntel. These partners include Supabase (Storage and Database), Google (AI Inference), and Vercel (Hosting). Each partner is vetted for SOC2 Type II compliance.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-12">
              <section>
                <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
                <p>
                  By accessing or using DocIntel ("the Service"), you agree to be bound by these Terms of Service. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">2. Permitted Use</h2>
                <p>
                  DocIntel is designed for professional document analysis. You may not use the platform to:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Upload malicious code, malware, or illegal content.</li>
                  <li>Attempt to reverse-engineer our proprietary RAG pipelines.</li>
                  <li>Circumvent storage or AI token limits through automated scripts.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">3. Intellectual Property</h2>
                <p>
                  <strong>Your Content:</strong> You retain 100% of the intellectual property rights to the documents you upload. DocIntel claims no ownership over your data.
                </p>
                <p>
                  <strong>Our Content:</strong> The DocIntel logo, codebase, visual identity, and proprietary AI handling logic are the property of Abdulrahim Ibrahim & Aliyu Wada and are protected by international copyright laws.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">4. Limitation of Liability</h2>
                <p>
                  While we strive for 100% accuracy, AI-generated insights can occasionally produce "hallucinations" or errors. DocIntel provides the Service "as is" and is not liable for business decisions made based on AI-generated summaries or chat responses.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">5. Termination</h2>
                <p>
                  We reserve the right to suspend accounts that violate our security protocols or engage in abusive behavior that impacts the stability of our multi-tenant infrastructure.
                </p>
              </section>
            </div>
          )}

          <footer className="mt-24 pt-12 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-400">
              Questions about these terms? Reach out to our legal team via the contact portal.
            </p>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}
