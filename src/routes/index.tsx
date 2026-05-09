import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { 
  Check, 
  MapPin, 
  Clock, 
  Phone, 
  ChevronRight, 
  Play, 
  Calendar,
  User,
  Scissors,
  Image as ImageIcon,
  Snowflake,
  Car,
  Coffee,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { cn } from "../lib/utils";
import heroBg from "@/assets/fundo_barbearia_escuro.jpg";
import { supabase } from "@/integrations/supabase/client";
import { BeamsBackground } from "@/components/ui/beams-background";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-black text-foreground font-sans overflow-x-hidden">
      <Hero />
      <SobreNos />
      <Localizacao />
      <Servicos />
      <Colaboradores />
      <Contato />
      <Footer />
    </div>
  );
}

// Seção de frases removida conforme solicitação

function Hero() {
  return (
    <section
      className="relative min-h-[90vh] pt-20 pb-10 px-4 flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <div className="absolute inset-0 bg-black/50 opacity-100" />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="z-10 flex flex-col items-center text-center"
      >
        <motion.img
          src="/logo.png"
          alt="Barbearia Pereira Logo"
          width={821}
          height={728}
          fetchPriority="high"
          decoding="async"
          className="w-[20.4rem] md:w-[27.2rem] mb-8 h-auto"
        />

        <motion.h1 
          initial={{ y: 10, opacity: 0 }}
          animate={{ 
            y: 0, 
            opacity: 1,
            color: ["#FFD700", "#FFFFFF", "#FFD700"]
          }}
          transition={{ 
            delay: 0.3, 
            duration: 0.8,
            color: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
          className="text-2xl md:text-4xl font-josefin font-bold tracking-wider mb-8 uppercase"
        >
          Tradição e Estilo em Cada Corte
        </motion.h1>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <Link
            to="/login"
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-primary-foreground bg-primary rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
          >
            <Calendar className="mr-2 h-5 w-5" />
            <span>AGENDAR AGORA</span>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

function SobreNos() {
  const [images, setImages] = useState<string[]>([]);
  const [emblaRef] = useEmblaCarousel({ 
    loop: true,
    align: "start",
    dragFree: true,
  }, [AutoScroll({ speed: 1, stopOnInteraction: false, stopOnMouseEnter: false })]);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const { data, error } = await (supabase
          .from("informacoes" as any)
          .select("imagem_1, imagem_2, imagem_3, imagem_4, imagem_5, imagem_6, imagem_7, imagem_8")
          .eq("userrr", "admin")
          .maybeSingle());

        if (error) throw error;
        if (data) {
          const infoData = data as any;
          const imgList = [
            infoData.imagem_1, infoData.imagem_2, infoData.imagem_3, infoData.imagem_4,
            infoData.imagem_5, infoData.imagem_6, infoData.imagem_7, infoData.imagem_8
          ].filter(img => img !== null && img !== "");
          setImages(imgList);
        }
      } catch (err) {
        console.error("Erro ao buscar galeria:", err);
      }
    };
    fetchImages();
  }, []);
  
  const features = [
    { icon: Snowflake, text: "Ambiente climatizado e confortável" },
    { icon: Car, text: "Fácil localização com estacionamento" },
    { icon: Coffee, text: "Atendimento personalizado e café cortesia" }
  ];

  return (
    <section id="sobre" className="py-20 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16 max-w-4xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary uppercase tracking-widest flex flex-col items-center gap-3">
            <User className="w-8 h-8" />
            Sobre Nós
          </h2>
          <div className="w-20 h-1 bg-primary mx-auto mb-8" />
          <p className="text-muted-foreground text-lg leading-relaxed">
            A Barbearia Pereira não é apenas um lugar para cortar o cabelo; é um espaço dedicado ao homem moderno que valoriza a tradição. Combinamos técnicas clássicas de barbearia com o que há de mais atual em tendências e cuidados masculinos, proporcionando uma experiência de relaxamento e renovação.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
          {features.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-primary/10 rounded-2xl p-8 flex flex-col items-center text-center gap-4 hover:border-primary/40 transition-all hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <p className="text-foreground font-bold uppercase tracking-wider text-sm leading-tight">
                  {item.text}
                </p>
              </motion.div>
            );
          })}
        </div>

        {images.length > 0 && (
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {images.map((src, index) => (
                <div key={index} className="flex-[0_0_80%] min-w-0 sm:flex-[0_0_40%] md:flex-[0_0_25%] pl-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="relative rounded-2xl overflow-hidden aspect-square border border-primary/20 shadow-lg group"
                  >
                    <img 
                      src={src} 
                      alt={`Galeria ${index + 1}`} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" 
                    />
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Localizacao() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const { data, error } = await (supabase
          .from("informacoes" as any)
          .select("video_local")
          .eq("userrr", "admin")
          .maybeSingle());

        if (error) throw error;
        if (data && (data as any).video_local) {
          setVideoUrl((data as any).video_local);
        }
      } catch (err) {
        console.error("Erro ao buscar vídeo de localização:", err);
      }
    };
    fetchVideo();
  }, []);

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary uppercase tracking-widest flex flex-col items-center justify-center gap-3">
            <MapPin className="w-8 h-8" />
            Nossa Localização
          </h2>
          <div className="w-20 h-1 bg-primary mx-auto mb-8" />
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="text-primary w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Endereço</h3>
                <p className="text-muted-foreground">Rua Resende, 561, Jardim Mariléa,<br />Rio das Ostras – RJ</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="text-primary w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Horário de Funcionamento</h3>
                <p className="text-muted-foreground">Terça a sábado de 09h às 20h<br />(Exceto feriados)</p>
              </div>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <button 
                  className="flex items-center gap-3 bg-secondary hover:bg-secondary/80 text-foreground px-6 py-4 rounded-xl transition-all border border-primary/10 w-fit"
                  disabled={!videoUrl}
                >
                  <Play className="fill-primary text-primary w-5 h-5" />
                  <span className="font-bold uppercase tracking-tight">Ver como chegar</span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] md:max-w-[80vw] lg:max-w-4xl w-fit p-0 overflow-hidden bg-black border-primary/20">
                <DialogHeader className="p-4 absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                  <DialogTitle className="text-primary font-josefin uppercase tracking-widest">Vídeo de Localização</DialogTitle>
                </DialogHeader>
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  {videoUrl && (
                    <video 
                      src={videoUrl} 
                      controls 
                      autoPlay 
                      className="max-w-full max-h-[85vh] w-auto h-auto shadow-2xl"
                    />
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl overflow-hidden border border-primary/20 shadow-2xl h-[400px]"
          >
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3686.075936301348!2d-41.9394622!3d-22.5036136!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x97a393961f6c8d%3A0x6d2c4b8b6c8b6c8b!2sRua%20Resende%2C%20561%20-%20Jardim%20Maril%C3%A9a%2C%20Rio%20das%20Ostras%20-%20RJ%2C%2028893-024!5e0!3m2!1spt-BR!2sbr!4v1714400000000!5m2!1spt-BR!2sbr" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Servicos() {
  const [servicos, setServicos] = useState<Array<{ img: string; nome: string; desc: string }>>([]);

  useEffect(() => {
    const fetchServicos = async () => {
      try {
        const { data, error } = await supabase
          .from("servicos")
          .select("name, image_url, detalhes")
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (data) {
          setServicos(
            data.map((s: any) => ({
              img: s.image_url || "/placeholder.svg",
              nome: s.name,
              desc: s.detalhes || "",
            }))
          );
        }
      } catch (err) {
        console.error("Erro ao buscar serviços:", err);
      }
    };
    fetchServicos();
  }, []);

  return (
    <section className="py-20 bg-secondary/20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary uppercase tracking-widest flex flex-col items-center justify-center gap-3">
            <Scissors className="w-8 h-8" />
            Nossos Serviços
          </h2>
          <div className="w-20 h-1 bg-primary mx-auto" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {servicos.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-card p-6 rounded-3xl border border-primary/10 hover:border-primary/40 transition-all hover:-translate-y-2 flex flex-col items-center text-center"
            >
              <div className="relative w-full aspect-square mb-6 overflow-hidden rounded-2xl">
                <img src={s.img} alt={s.nome} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">{s.nome}</h3>
              <p className="text-muted-foreground text-sm">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Colaboradores() {
  const [time, setTime] = useState<{ nome: string; img: string; desc: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("nome, foto_url, resumo, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (!error && data) {
        setTime(
          data.map((c: any) => ({
            nome: c.nome,
            img: c.foto_url || "/placeholder.svg",
            desc: c.resumo || "",
          }))
        );
      }
    })();
  }, []);

  if (time.length === 0) return null;

  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary uppercase tracking-widest flex flex-col items-center justify-center gap-3">
            <User className="w-8 h-8" />
            Nossos Colaboradores
          </h2>
          <div className="w-24 h-1 bg-primary mx-auto" />
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {time.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex flex-col items-center text-center"
            >
              <div className="relative w-48 h-48 mb-8">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-2 rounded-full overflow-hidden border-4 border-card shadow-xl">
                  <img src={c.img} alt={c.nome} className="w-full h-full object-cover" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-primary">{c.nome}</h3>
              <div className="bg-card/50 p-6 rounded-2xl border border-primary/5 italic text-muted-foreground">
                "{c.desc}"
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Galeria removida conforme solicitação

function Contato() {
  const [whatsappNumber, setWhatsappNumber] = useState("");

  useEffect(() => {
    const fetchWhatsapp = async () => {
      try {
        const { data, error } = await supabase
          .from("informacoes" as any)
          .select("tel_contato")
          .eq("userrr", "admin")
          .maybeSingle();

        if (!error && data) {
          const rawTel = (data as any).tel_contato || "";
          const cleaned = rawTel.replace(/\D/g, "");
          setWhatsappNumber(cleaned.startsWith("55") ? cleaned : `55${cleaned}`);
        }
      } catch (err) {
        console.error("Erro ao buscar whatsapp:", err);
      }
    };
    fetchWhatsapp();
  }, []);

  const whatsappLink = `https://wa.me/${whatsappNumber}`;
  
  return (
    <section className="py-20 bg-primary/5 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-primary uppercase tracking-widest flex flex-col items-center justify-center gap-3">
          <Phone className="w-8 h-8" />
          Pronto para dar um trato no visual?
        </h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          Estamos prontos para te atender. Entre em contato caso tenha alguma dúvida pelo botão abaixo.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold h-auto py-4 px-8 text-lg hover:scale-105 transition-transform border-none">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Phone className="mr-2 h-6 w-6" />
              <span>Falar no WhatsApp</span>
            </a>
          </Button>

          <Button asChild variant="outline" size="lg" className="rounded-full font-bold h-auto py-4 px-8 text-lg hover:scale-105 transition-transform border-primary/20">
            <a href="https://www.instagram.com/brunovital14/" target="_blank" rel="noopener noreferrer">
              <svg className="mr-2 h-6 w-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.335 3.608 1.31.975.975 1.248 2.242 1.31 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.335 2.633-1.31 3.608-.975.975-2.242 1.248-3.608 1.31-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.335-3.608-1.31-.975-.975-1.248-2.242-1.31-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.335-2.633 1.31-3.608.975-.975 2.242-1.248 3.608-1.31 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948s.014 3.667.072 4.947c.2 4.337 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.337-.2 6.78-2.618 6.98-6.98.058-1.281.072-1.689.072-4.948s-.014-3.667-.072-4.947c-.2-4.337-2.618-6.78-6.98-6.98-1.281-.058-1.689-.072-4.948-.072zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>Instagram</span>
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-card py-16 px-4 border-t border-primary/10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        <div className="space-y-4">
          <img src="/logo.png" alt="Logo" className="w-32 opacity-80" />
          <p className="text-muted-foreground text-sm uppercase tracking-tighter">Barbearia Pereira</p>
          <div className="text-xs text-muted-foreground/60 space-y-1">
            <p>CNPJ: 19.411.344/0001-11</p>
            <p>Rio das Ostras - RJ</p>
          </div>
        </div>

        <div>
          <h4 className="text-primary font-bold mb-6 uppercase tracking-widest">Links Rápidos</h4>
          <ul className="space-y-4">
            <li><Link to="/login" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group"><ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /> Login</Link></li>
            <li><Link to="/login" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 group"><ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /> Agendamento</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-primary font-bold mb-6 uppercase tracking-widest">Localização</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Rua Resende, 561, Jardim Mariléa,<br />
            Rio das Ostras – RJ<br /><br />
            Terça a sábado: 09h às 20h
          </p>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto pt-8 border-t border-primary/5 text-center text-xs text-muted-foreground/40">
        &copy; {new Date().getFullYear()} Barbearia Pereira. Todos os direitos reservados.
      </div>
    </footer>
  );
}
