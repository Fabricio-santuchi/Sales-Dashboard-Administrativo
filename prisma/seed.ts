import prisma from "@/lib/prisma";
import { gerarDadosDemo } from "@/lib/dados-demo";

async function main() {
  console.log("🌱 Gerando dados de demonstração a partir de hoje...");
  await gerarDadosDemo();
  console.log("✅ Seed concluído com sucesso!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
