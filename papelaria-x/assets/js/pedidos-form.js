/**
 * Construtor Dinâmico de Itens do Pedido (novo.php e editar.php) - Papelaria X
 */
document.addEventListener('DOMContentLoaded', function () {
    const itensBody = document.getElementById('itensBody');
    const avisoSemItens = document.getElementById('avisoSemItens');
    const selectCatalogo = document.getElementById('catalogoProdutoSelect');
    const btnAddCatalogo = document.getElementById('btnAddCatalogo');
    const btnAddManual = document.getElementById('btnAdicionarItemManual');
    const inputDesconto = document.getElementById('inputDesconto');
    const resumoSubtotal = document.getElementById('resumoSubtotal');
    const resumoTotal = document.getElementById('resumoTotal');

    // Alternância Cliente Existente vs Novo Cliente (presente em novo.php)
    const radioExistente = document.getElementById('modoExistente');
    const radioNovo = document.getElementById('modoNovo');
    const blocoExistente = document.getElementById('blocoClienteExistente');
    const blocoNovo = document.getElementById('blocoClienteNovo');
    const selectCliente = document.getElementById('selectCliente');
    const clienteObsPreview = document.getElementById('clienteObsPreview');

    function atualizarModoCliente() {
        if (!radioExistente || !radioNovo) return;
        const ehNovo = radioNovo.checked;
        blocoExistente.classList.toggle('d-none', ehNovo);
        blocoNovo.classList.toggle('d-none', !ehNovo);
    }

    if (radioExistente && radioNovo) {
        radioExistente.addEventListener('change', atualizarModoCliente);
        radioNovo.addEventListener('change', atualizarModoCliente);
    }

    if (selectCliente && clienteObsPreview) {
        selectCliente.addEventListener('change', function () {
            const opt = selectCliente.options[selectCliente.selectedIndex];
            const obs = opt ? (opt.dataset.obs || '') : '';
            if (obs.trim() !== '') {
                clienteObsPreview.textContent = 'Observação do cliente: ' + obs;
                clienteObsPreview.classList.remove('d-none');
            } else {
                clienteObsPreview.textContent = '';
                clienteObsPreview.classList.add('d-none');
            }
        });
    }

    function formatarBRL(valor) {
        return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function recalcularTotais() {
        const linhas = itensBody.querySelectorAll('tr');
        avisoSemItens.classList.toggle('d-none', linhas.length > 0);

        let subtotal = 0;
        linhas.forEach(function (tr) {
            const qtd = parseFloat(tr.querySelector('.item-qtd').value) || 0;
            const vUnit = parseFloat(tr.querySelector('.item-valor').value) || 0;
            const sub = Math.max(0, qtd * vUnit);
            tr.querySelector('.item-subtotal').textContent = formatarBRL(sub);
            subtotal += sub;
        });

        let desconto = parseFloat(inputDesconto.value) || 0;
        if (desconto < 0) desconto = 0;
        if (desconto > subtotal) desconto = subtotal;

        const total = Math.max(0, subtotal - desconto);
        resumoSubtotal.textContent = formatarBRL(subtotal);
        resumoTotal.textContent = formatarBRL(total);
    }

    function adicionarLinha(dados) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="hidden" name="item_produto_id[]" value="${dados.produtoId ? String(dados.produtoId) : ''}">
                <input type="text" name="item_descricao[]" class="form-control form-control-sm item-desc" required placeholder="Descrição do item ou serviço">
            </td>
            <td>
                <input type="text" name="item_unidade[]" class="form-control form-control-sm item-unid" value="un" maxlength="30">
            </td>
            <td>
                <input type="number" name="item_quantidade[]" class="form-control form-control-sm font-mono-num text-end item-qtd" step="0.01" min="0.01" required>
            </td>
            <td>
                <input type="number" name="item_valor_unitario[]" class="form-control form-control-sm font-mono-num text-end item-valor" step="0.01" min="0" required>
            </td>
            <td class="text-end font-mono-num fw-semibold item-subtotal">R$ 0,00</td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-danger btn-remover-item" title="Remover item">&times;</button>
            </td>
        `;

        tr.querySelector('.item-desc').value = dados.descricao || '';
        tr.querySelector('.item-unid').value = dados.unidade || 'un';
        tr.querySelector('.item-qtd').value = dados.quantidade !== undefined ? dados.quantidade : 1;
        tr.querySelector('.item-valor').value = dados.valorUnitario !== undefined ? Number(dados.valorUnitario).toFixed(2) : '0.00';

        tr.querySelector('.item-qtd').addEventListener('input', recalcularTotais);
        tr.querySelector('.item-valor').addEventListener('input', recalcularTotais);
        tr.querySelector('.btn-remover-item').addEventListener('click', function () {
            tr.remove();
            recalcularTotais();
        });

        itensBody.appendChild(tr);
        recalcularTotais();
    }

    if (btnAddCatalogo && selectCatalogo) {
        btnAddCatalogo.addEventListener('click', function () {
            const opt = selectCatalogo.options[selectCatalogo.selectedIndex];
            if (!opt || !opt.value) return;

            adicionarLinha({
                produtoId: opt.value,
                descricao: opt.dataset.nome || '',
                unidade: opt.dataset.unidade || 'un',
                quantidade: 1,
                valorUnitario: parseFloat(opt.dataset.preco || '0')
            });
            selectCatalogo.value = '';
        });
    }

    if (btnAddManual) {
        btnAddManual.addEventListener('click', function () {
            adicionarLinha({
                produtoId: '',
                descricao: '',
                unidade: 'un',
                quantidade: 1,
                valorUnitario: 0
            });
        });
    }

    if (inputDesconto) {
        inputDesconto.addEventListener('input', recalcularTotais);
    }

    // Carregar itens iniciais (modo edição)
    if (Array.isArray(window.ITENS_INICIAIS_PEDIDO) && window.ITENS_INICIAIS_PEDIDO.length > 0) {
        window.ITENS_INICIAIS_PEDIDO.forEach(function (it) {
            adicionarLinha({
                produtoId: it.produto_id || '',
                descricao: it.descricao_item || '',
                unidade: it.unidade_medida || 'un',
                quantidade: parseFloat(it.quantidade || 1),
                valorUnitario: parseFloat(it.valor_unitario || 0)
            });
        });
    } else {
        recalcularTotais();
    }
});
