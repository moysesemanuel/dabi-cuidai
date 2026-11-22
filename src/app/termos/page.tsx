import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de uso · Cuidaí Kids",
  description: "As regras de uso do Cuidaí Kids.",
};

/** Página pública (fora do grupo do app). Mudou o texto? Suba a versão em src/lib/legal.ts. */
export default function TermosPage() {
  return (
    <LegalPage doc="terms">
      <Section title="O que é o Cuidaí Kids">
        <p>
          O Cuidaí Kids é um app gratuito, oferecido pela {COMPANY.tradeName}, para lembrar os horários dos remédios das
          crianças e organizar o que a família quer acompanhar: diário de saúde, medições de crescimento, marcos do
          desenvolvimento e um resumo para levar às consultas. Ao usar o app, você concorda com estes termos e com a
          Política de privacidade.
        </p>
      </Section>

      <Section title="O app não substitui o pediatra">
        <ul className="list-disc pl-5">
          <li>O app não calcula nem sugere doses. Use sempre a dose e o intervalo da receita e as orientações do profissional de saúde.</li>
          <li>O app não interpreta sintomas, temperaturas, medições ou marcos e não faz diagnósticos.</li>
          <li>
            A idade corrigida e os gráficos são referências para o acompanhamento, e a interpretação deve ser feita com o
            profissional de saúde.
          </li>
          <li>
            Em caso de urgência, ligue para o SAMU (192) ou procure um pronto-atendimento. Não espere por um registro ou
            aviso do app.
          </li>
        </ul>
      </Section>

      <Section title="Os avisos podem falhar">
        <p>
          Os avisos de horário dependem da internet, das permissões de notificação, da economia de bateria e do sistema
          do celular. Eles ajudam, mas não garantem que a dose será lembrada. Continue atento aos horários.
        </p>
      </Section>

      <Section title="Quem pode usar">
        <p>
          O app é para mães, pais e responsáveis maiores de 18 anos, e para quem cuida das crianças com a autorização
          deles. Ao criar uma família ou entrar em uma, você confirma que é responsável pelas crianças cadastradas ou que
          tem autorização de quem é.
        </p>
      </Section>

      <Section title="O código da família">
        <p>
          O código dá acesso a todos os dados da família, sem senha. Guarde-o e compartilhe só com quem cuida das
          crianças. Se ele chegar a outra pessoa, troque o código e desconecte os celulares que você não reconhece, no
          Perfil. Você responde pelo uso do app feito com o código da sua família.
        </p>
      </Section>

      <Section title="Uso adequado">
        <ul className="list-disc pl-5">
          <li>Não registre dados de crianças pelas quais você não é responsável.</li>
          <li>Não tente acessar dados de outras famílias nem descobrir códigos de outras pessoas.</li>
          <li>Não use o app de forma que atrapalhe o funcionamento dele para as outras famílias.</li>
        </ul>
      </Section>

      <Section title="Os dados registrados">
        <p>
          O que a família registra continua sendo da família. Usamos esses dados só para fazer o app funcionar, como
          explicado na Política de privacidade. A família pode baixar uma cópia ou excluir tudo a qualquer momento, no
          Perfil.
        </p>
      </Section>

      <Section title="Disponibilidade e mudanças">
        <p>
          Trabalhamos para manter o app no ar, mas ele pode ficar indisponível por manutenção ou falhas. Funções podem
          mudar com o tempo. Se estes termos mudarem, publicamos uma nova versão e o app pede o aceite de novo. Se um dia
          o serviço for encerrado, avisaremos com antecedência para a família poder baixar uma cópia dos dados.
        </p>
      </Section>

      <Section title="Responsabilidade">
        <p>
          O app é uma ferramenta de apoio à rotina da família. As decisões sobre a saúde das crianças são dos responsáveis,
          com orientação profissional. Nada nestes termos limita os direitos garantidos pelo Código de Defesa do
          Consumidor.
        </p>
      </Section>

      <Section title="Lei aplicável">
        <p>
          Estes termos seguem as leis do Brasil. Eventuais questões podem ser levadas ao foro do seu domicílio.
        </p>
      </Section>
    </LegalPage>
  );
}
