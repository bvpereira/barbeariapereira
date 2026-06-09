import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl md:text-6xl font-bold font-josefin uppercase tracking-widest text-primary mb-4">
          Bem-vindo
        </h1>
        <div className="w-24 h-1 bg-primary mx-auto" />
      </motion.div>
    </div>
  );
}
