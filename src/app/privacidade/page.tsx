import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacidade · Cuidaí Kids",
  description: "Como o Cuidaí Kids guarda e usa os dados da família.",
};

/**
 * Página pública (fora do grupo do app). Mudou o texto? Suba a versão em src/lib/legal.ts.
 * Regiões e retenção conferidas em 21/11/2026: Vercel gru1 (vercel.json), Neon aws-sa-east-1 (histórico de 6 h,
 * sem cópias agendadas), QStash us-east-1, registros da Vercel por 1 h.
 */
export default function PrivacidadePage() {
  return (
    <LegalPage doc="privacy">
      <Section title="Em poucas palavras">
        <ul className="list-disc pl-5">
          <li>O app guarda só o que a família registra, para lembrar os horários dos remédios e organizar o acompanhamento das crianças.</li>
          <li>Não pedimos e-mail, telefone, CPF nem senha. O acesso é pelo código da família.</li>
          <li>Não vendemos dados, não mostramos anúncios e não usamos os dados para outra finalidade.</li>
          <li>A família pode baixar uma cópia ou excluir tudo a qualquer momento, no Perfil.</li>
        </ul>
      </Section>

      <Section title="Quem é responsável pelos dados">
        <p>
          O controlador dos dados é a {COMPANY.tradeName} ({COMPANY.legalName}, CNPJ {COMPANY.cnpj}), com endereço na{" "}
          {COMPANY.address}. O encarregado pelo tratamento de dados é {COMPANY.dataProtectionOfficer}, que atende pedidos
          sobre dados pelo e-mail{" "}
          <a className="font-bold text-brand underline" href={`mailto:${COMPANY.privacyEmail}`}>
            {COMPANY.privacyEmail}
          </a>
          .
        </p>
      </Section>

      <Section title="Quais dados o app guarda">
        <p>Para cada família:</p>
        <ul className="list-disc pl-5">
          <li>
            <b>Código da família</b>, que dá acesso aos dados compartilhados.
          </li>
          <li>
            <b>Celulares conectados:</b> o nome que a pessoa escolher colocar (opcional), o tipo de aparelho e navegador
            (por exemplo, &quot;iPhone · Safari&quot;), quando foi conectado e usado pela última vez, a inscrição para
            receber os avisos e o registro do aceite destes documentos (versão e data).
          </li>
          <li>
            <b>Crianças:</b> nome, cor escolhida, foto (opcional), data de nascimento, se nasceu prematura e a idade
            gestacional (opcionais).
          </li>
          <li>
            <b>Remédios:</b> nome, dose como está na receita, intervalo, duração e o registro de cada dose (prevista,
            dada e o horário em que foi marcada).
          </li>
          <li>
            <b>Diário:</b> temperaturas, sintomas e anotações registrados pela família.
          </li>
          <li>
            <b>Crescimento e marcos:</b> peso, comprimento e os momentos do desenvolvimento registrados.
          </li>
        </ul>
        <p>
          Informações de saúde de crianças são dados sensíveis pela Lei Geral de Proteção de Dados (LGPD). Elas são usadas
          apenas para o funcionamento do app para a própria família.
        </p>
        <p>
          O app usa um único cookie, necessário para manter o celular conectado à família, e guarda no próprio aparelho só
          preferências de exibição, como o tema claro ou escuro. Não usamos cookies de publicidade nem de rastreamento.
        </p>
      </Section>

      <Section title="Para que os dados são usados">
        <ul className="list-disc pl-5">
          <li>Mostrar os remédios e as doses do dia e enviar os avisos de horário.</li>
          <li>Guardar o histórico, o diário, o crescimento e os marcos, e montar o resumo para consultas.</li>
          <li>Manter o app funcionando e seguro (por exemplo, limitar tentativas de entrar com códigos errados).</li>
        </ul>
        <p>
          O app não interpreta sintomas, não faz diagnósticos e não sugere remédios ou doses. As informações são
          registradas pela família e não são conferidas por profissionais de saúde.
        </p>
      </Section>

      <Section title="Base legal e consentimento">
        <p>
          Os dados das crianças são tratados no melhor interesse delas, com o consentimento específico e em destaque de
          um dos pais ou do responsável legal (LGPD, artigos 11 e 14). Esse consentimento é dado no próprio app, antes de
          criar uma família ou entrar em uma, e fica registrado com a versão destes documentos e a data, em cada celular.
          Ele pode ser revogado a qualquer momento, saindo da família no celular ou excluindo os dados da família.
        </p>
      </Section>

      <Section title="Onde os dados ficam e com quem são compartilhados">
        <p>Não vendemos nem cedemos dados a terceiros. Para funcionar, o app usa estes serviços, que processam os dados em nosso nome:</p>
        <ul className="list-disc pl-5">
          <li>
            <b>Neon</b> (banco de dados, na Amazon Web Services em São Paulo, Brasil): é onde as informações ficam
            guardadas.
          </li>
          <li>
            <b>Vercel</b> (hospedagem, servidores em São Paulo, Brasil): recebe as requisições do app e consulta o banco
            para responder. Não guarda os dados das crianças.
          </li>
          <li>
            <b>Upstash</b> (agendamento, nos Estados Unidos): agenda a hora de enviar cada aviso. Recebe apenas o
            endereço do app e o horário, sem dados das crianças.
          </li>
          <li>
            <b>Serviços de notificação do celular</b> (Apple, Google ou Mozilla, conforme o aparelho): entregam os
            avisos. O aviso leva o nome da criança e do remédio, e o conteúdo vai criptografado de ponta a ponta.
          </li>
        </ul>
        <p>
          Os dados das crianças são guardados e processados no Brasil. Saem do país apenas o agendamento dos avisos, que
          não leva dados das crianças, e a entrega das notificações pelos serviços do próprio celular, com o conteúdo
          criptografado. Essa transferência internacional é feita com provedores que adotam medidas de segurança
          compatíveis com a LGPD e com base no consentimento do responsável.
        </p>
      </Section>

      <Section title="Quem tem acesso">
        <p>
          Qualquer pessoa que tenha o código da família consegue entrar e ver ou alterar todos os dados da família.
          Compartilhe o código só com quem cuida das crianças. No Perfil, é possível trocar o código e desconectar
          celulares que não deveriam ter acesso.
        </p>
      </Section>

      <Section title="Por quanto tempo os dados ficam guardados">
        <p>
          Enquanto a família usar o app. Quando a família exclui os dados no Perfil, tudo é apagado na hora: crianças,
          fotos, remédios, histórico, diário, medições, marcos e celulares conectados.
        </p>
        <p>
          O banco mantém um histórico técnico das últimas 6 horas, usado só para recuperar o serviço em caso de falha.
          Por isso, dados excluídos deixam de existir também nesse histórico em até 6 horas. Não fazemos outras cópias de
          segurança. Os registros técnicos do servidor não incluem dados de saúde e são apagados em até 1 hora.
        </p>
      </Section>

      <Section title="Seus direitos">
        <ul className="list-disc pl-5">
          <li>
            <b>Ver e levar os dados:</b> no Perfil, em &quot;Baixar uma cópia dos dados&quot;.
          </li>
          <li>
            <b>Corrigir:</b> qualquer informação pode ser editada no próprio app.
          </li>
          <li>
            <b>Excluir:</b> no Perfil, em &quot;Excluir todos os dados da família&quot;.
          </li>
          <li>
            <b>Revogar o consentimento:</b> saindo da família no celular ou excluindo os dados.
          </li>
          <li>
            <b>Outros pedidos ou dúvidas</b> (confirmação de tratamento, informações sobre compartilhamento, reclamações):
            pelo e-mail{" "}
            <a className="font-bold text-brand underline" href={`mailto:${COMPANY.privacyEmail}`}>
              {COMPANY.privacyEmail}
            </a>
            . Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
          </li>
        </ul>
      </Section>

      <Section title="Segurança">
        <p>
          A conexão com o app é criptografada (HTTPS). O código da família tem 12 letras e números e há limite de
          tentativas para entrar. Cada celular tem a sua própria sessão, que pode ser desconectada a qualquer momento.
        </p>
      </Section>

      <Section title="Mudanças nesta política">
        <p>Se esta política mudar, publicamos a nova versão nesta página, com a data, e o app pede o aceite de novo.</p>
      </Section>
    </LegalPage>
  );
}
