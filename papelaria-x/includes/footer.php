        </main>
    </div>
</div>

<!-- Modal Universal de Revisão e Envio WhatsApp -->
<div class="modal fade no-print" id="modalWhatsApp" tabindex="-1" aria-labelledby="modalWhatsAppLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title fw-semibold d-flex align-items-center gap-2" id="modalWhatsAppLabel">
                    <?= icon('whatsapp', 20, 'text-success') ?>
                    <span>Enviar Mensagem pelo WhatsApp</span>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body">
                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label small text-muted mb-1">Cliente</label>
                        <input type="text" id="waClienteNome" class="form-control form-control-sm" readonly>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small text-muted mb-1">Telefone / WhatsApp</label>
                        <input type="text" id="waTelefoneExibicao" class="form-control form-control-sm font-mono-num" readonly>
                        <input type="hidden" id="waTelefoneLimpo">
                    </div>
                </div>

                <div class="mb-3">
                    <label for="waModeloSelect" class="form-label fw-medium">Modelo de mensagem</label>
                    <select id="waModeloSelect" class="form-select">
                        <option value="registro">Registro do pedido</option>
                        <option value="confirmacao">Confirmação do pedido</option>
                        <option value="producao">Pedido em produção</option>
                        <option value="pronto">Pedido pronto para retirada</option>
                        <option value="entregue">Pedido entregue</option>
                    </select>
                </div>

                <div class="mb-2">
                    <label for="waMensagemTexto" class="form-label fw-medium">Revise a mensagem antes de enviar</label>
                    <textarea id="waMensagemTexto" class="form-control" rows="10"></textarea>
                    <div class="form-text">Você pode ajustar qualquer texto acima antes de abrir o WhatsApp.</div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <a href="#" id="waBtnAbrir" target="_blank" rel="noopener noreferrer" class="btn btn-success d-inline-flex align-items-center gap-2">
                    <?= icon('whatsapp', 18) ?>
                    <span>Abrir no WhatsApp</span>
                </a>
            </div>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="<?= e(url('assets/js/app.js')) ?>"></script>
</body>
</html>
