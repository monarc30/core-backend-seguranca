# Proposta do Projeto — Core Backend de Segurança

> Texto original da proposta/descrição do projeto, para conferência.

---

## Descrição

Estamos buscando um desenvolvedor backend experiente para criar e implementar um core backend de segurança reutilizável, que será integrado a três de nossas aplicações SaaS existentes. Este projeto é crucial para fortalecer a segurança, garantir o isolamento multi-tenant e centralizar o controle de operações críticas.

O escopo do projeto inclui:

1. Desenvolvimento de um backend intermediário robusto que atuará entre o frontend das aplicações e o banco de dados (Supabase).
2. Implementação de validação de autenticação baseada em token para todas as requisições.
3. Garantia de isolamento multi-tenant obrigatório, com checagem rigorosa de 'account_id' em todas as rotas sensíveis para prevenir acesso cruzado entre contas.
4. Remoção de qualquer acesso direto do frontend a operações críticas do banco de dados.
5. Controle de planos e assinaturas exclusivamente através de eventos confirmados de pagamento, sem possibilidade de alteração via frontend.
6. Criação de um endpoint de webhook seguro, com validação de assinatura e um mecanismo de idempotência para prevenir o processamento duplicado de eventos.
7. Assegurar que chaves administrativas e variáveis sensíveis permaneçam estritamente no backend, sem exposição ao frontend.
8. Implementação de logs de auditoria detalhados para todas as ações críticas, incluindo alterações de plano, eventos de faturamento e ações administrativas.

## Integração e Testes

- Integração completa do novo backend nas três plataformas SaaS existentes, substituindo chamadas diretas ao banco de dados por chamadas à nova API intermediária nas rotas sensíveis.
- Realização de testes exaustivos de isolamento entre usuários e empresas.
- Testes de tentativa de alteração de plano via frontend para garantir a rejeição.
- Validação da rejeição de webhooks inválidos.

## Entregáveis

- Código-fonte completo e bem documentado, entregue em um repositório Git do contratante.
- Configuração de deploy em um ambiente a ser definido em conjunto.
- Documentação técnica abrangente, incluindo detalhes dos endpoints da API, variáveis de ambiente necessárias e instruções de configuração.

O projeto será considerado concluído somente após a validação funcional de que não há acesso cruzado entre contas, que os planos não podem ser alterados sem confirmação real de pagamento e que nenhuma chave administrativa está exposta no frontend.
