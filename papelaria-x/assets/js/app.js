/**
 * Scripts Globais - Papelaria X
 */
document.addEventListener('DOMContentLoaded', function () {
    // 1. Modal Universal de WhatsApp (revisão + link https://wa.me/)
    const modalEl = document.getElementById('modalWhatsApp');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const waModal = new bootstrap.Modal(modalEl);
        const inputCliente = document.getElementById('waClienteNome');
        const inputTelExibicao = document.getElementById('waTelefoneExibicao');
        const inputTelLimpo = document.getElementById('waTelefoneLimpo');
        const selectModelo = document.getElementById('waModeloSelect');
        const textareaMsg = document.getElementById('waMensagemTexto');
        const btnAbrir = document.getElementById('waBtnAbrir');

        let templatesAtuais = {};

        function atualizarLinkWhatsApp() {
            const numero = (inputTelLimpo.value || '').replace(/\D+/g, '');
            const texto = textareaMsg.value || '';
            btnAbrir.href = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
        }

        document.body.addEventListener('click', function (ev) {
            const trigger = ev.target.closest('.btn-open-wa');
            if (!trigger) return;

            inputCliente.value = trigger.dataset.cliente || '';
            inputTelExibicao.value = trigger.dataset.telefoneExibicao || '';
            inputTelLimpo.value = trigger.dataset.telefoneWa || '';

            try {
                templatesAtuais = JSON.parse(trigger.dataset.templates || '{}');
            } catch (e) {
                templatesAtuais = {};
            }

            const modeloPadrao = trigger.dataset.modeloInicial || 'registro';
            selectModelo.value = templatesAtuais[modeloPadrao] ? modeloPadrao : 'registro';
            textareaMsg.value = templatesAtuais[selectModelo.value] || '';
            atualizarLinkWhatsApp();
            waModal.show();
        });

        selectModelo.addEventListener('change', function () {
            const key = selectModelo.value;
            if (templatesAtuais[key] !== undefined) {
                textareaMsg.value = templatesAtuais[key];
                atualizarLinkWhatsApp();
            }
        });

        textareaMsg.addEventListener('input', atualizarLinkWhatsApp);
    }

    // 2. Máscara leve de telefone brasileiro em inputs com classe .mask-telefone
    document.querySelectorAll('.mask-telefone').forEach(function (input) {
        input.addEventListener('input', function () {
            let v = input.value.replace(/\D+/g, '').slice(0, 11);
            if (v.length > 6) {
                if (v.length === 11) {
                    v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
                } else {
                    v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 6) + '-' + v.slice(6);
                }
            } else if (v.length > 2) {
                v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
            }
            input.value = v;
        });
    });
});
