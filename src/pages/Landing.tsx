import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Database, Brain, Zap, Download, Shield, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoDark from '@/assets/logo-dark.png';

const features = [
  { icon: Database, title: 'Smart Upload', desc: 'CSV & JSON with instant preview and column profiling' },
  { icon: Brain, title: 'AI Analysis', desc: 'Automated column classification with reasoning explanations' },
  { icon: Zap, title: 'Auto Cleaning', desc: 'Outlier removal, null imputation, duplicate detection' },
  { icon: BarChart3, title: 'Advanced Stats', desc: 'Skewness, kurtosis, correlations, distribution analysis' },
  { icon: Shield, title: 'Smart Detection', desc: 'Email, ID, and identifier columns auto-detected and flagged' },
  { icon: Download, title: 'Export Ready', desc: 'ML-ready CSV and LLM-ready JSON in one click' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background dark">
      {/* Nav */}
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <img src={logoDark} alt="Pipeline Labs" className="h-8 w-8 invert dark:invert-0" />
            <span className="text-lg font-bold tracking-tight text-foreground">Pipeline Labs</span>
          </div>
          <Link to="/auth">
            <Button variant="outline" className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-foreground md:text-7xl">
            Dataset to
            <br />
            Model-Ready
            <br />
            <span className="text-muted-foreground">in Minutes</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Upload raw data. Get clean, structured, ML-ready and LLM-ready datasets.
            AI-assisted preprocessing with full transparency and user control.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="gap-2 px-8">
                Start Processing <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Pipeline Visual */}
      <section className="border-y border-border bg-card">
        <div className="container py-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium"
          >
            {['Upload', 'Analyze', 'Clean', 'Transform', 'Export'].map((step, i) => (
              <div key={step} className="flex items-center gap-4">
                <div className="border border-border bg-background px-6 py-3 text-foreground">
                  {step}
                </div>
                {i < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-24">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mb-16 text-center text-3xl font-bold text-foreground"
        >
          Everything you need
        </motion.h2>
        <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-background p-8"
            >
              <f.icon className="mb-4 h-5 w-5 text-foreground" />
              <h3 className="mb-2 text-lg font-bold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="container py-24 text-center">
          <h2 className="text-3xl font-bold text-foreground">Ready to transform your data?</h2>
          <p className="mt-4 text-muted-foreground">No credit card required. Start processing immediately.</p>
          <Link to="/auth">
            <Button size="lg" className="mt-8 gap-2 px-8">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2026 Pipeline Labs. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
