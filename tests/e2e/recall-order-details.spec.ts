import { expect, test } from '@playwright/test';
import { viewRecallOrderDetails } from '../../flows/recall.flow';
import { RecallPage } from '../../pages/recall.page';

const fullOrderDetailFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="recall2-header-new-order">New Order</button>
    <button type="button" data-testid="recall2-header-paging">Paging</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderStatus">Order Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderType">Order Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentType">Payment Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-productLine">Product Line</button>
    <button type="button" data-testid="recall2-search-trigger">Search</button>
    <button type="button" data-testid="icon-button-More Filters">More Filters</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="recall2-order-card-1">#1</button>
    </div>

    <div
      role="dialog"
      aria-modal="true"
      data-testid="pos-ui-modal"
      hidden
    >
      <div class="_content_6unfp_324 _modalContent_1l2ju_458">
        <div class="_header_1ej2d_479">
          <div class="_container_1bmdj_453">
            <div class="_orderNumber_1bmdj_459"><span class="_number_1bmdj_480">#1</span></div>
            <div class="_status_1bmdj_494"><span class="_statusTag_1bmdj_500">Semi-Paid</span></div>
          </div>
          <div class="_actionButtons_gham7_478">
            <button type="button" class="_actionButton_1f1k8_453">Dine In</button>
            <button type="button" class="_actionButton_1f1k8_453">3(1)</button>
            <button type="button" class="_actionButton_1f1k8_453">Boss</button>
          </div>
        </div>

        <div class="_section_201h3_462">
          <div class="_header_blu61_457"><h3>CUSTOMER INFO</h3></div>
          <div class="_content_blu61_472">
            <div data-test-id="shared-order-detail-customer-info-open" class="_customerInfoCard_1l2ju_594">
              <div class="_customerPrimaryRow_1l2ju_606">
                <div class="_customerPrimaryCell_1l2ju_613">
                  <span class="_customerPrimaryText_1l2ju_640">小林林</span>
                </div>
                <div class="_customerPrimaryCell_1l2ju_613">
                  <span class="_customerPrimaryText_1l2ju_640">(934)221-9929</span>
                </div>
              </div>
              <div class="_customerDetailRow_1l2ju_651">
                <span class="_customerDetailText_1l2ju_657 _customerAddressText_1l2ju_667">
                  611 Jersey Ave, aa, Jersey City, NJ 07302
                </span>
              </div>
              <div class="_customerDetailRow_1l2ju_651">
                <span class="_customerDetailText_1l2ju_657 _customerNoteText_1l2ju_675">
                  JGSRJRJRYSGHDRF
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="_section_201h3_462">
          <div class="_header_blu61_457"><h3>MEMBER INFO</h3></div>
          <div class="_content_blu61_472">
            <div data-test-id="shared-order-detail-member-info-open" class="_memberInfoCard_1l2ju_728">
              <div class="_memberInfoItem_1l2ju_740">
                <span class="_memberInfoText_1l2ju_767">8f1a4d13-8703-4436-b988-b25030bb4f8f</span>
              </div>
              <div class="_memberInfoItem_1l2ju_740">
                <span class="_memberInfoText_1l2ju_767">VIP Gold</span>
              </div>
            </div>
          </div>
        </div>

        <div class="_section_201h3_462">
          <div class="_header_blu61_457"><h3>PAYMENT</h3></div>
          <div class="_content_blu61_472">
            <div class="_card_7kgct_437">
              <div class="_paymentInfo_7kgct_458">
                <div class="_paymentType_7kgct_465">
                  <span class="_paymentText_7kgct_472">
                    <span class="_methodLabel_7kgct_492">Cash</span>
                  </span>
                  <span class="_amount_7kgct_501">$33.65</span>
                </div>
                <div class="_content_7kgct_509">
                  <div class="_contentItem_7kgct_517">
                    <span class="_detailLabel_7kgct_523">Tips:</span>
                    <span class="_detailAmount_7kgct_524">$0.00</span>
                  </div>
                  <div class="_contentItem_7kgct_517">
                    <span class="_detailLabel_7kgct_523">Change:</span>
                    <span class="_detailAmount_7kgct_524">$0.00</span>
                  </div>
                  <div class="_contentItem_7kgct_517">
                    <span class="_detailLabel_7kgct_523">Service Charge:</span>
                    <span class="_detailAmount_7kgct_524">$1.25</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="_card_7kgct_437">
              <div class="_paymentInfo_7kgct_458">
                <div class="_paymentType_7kgct_465">
                  <span class="_paymentText_7kgct_472">
                    <span class="_methodLabel_7kgct_492">Gift Card</span>
                  </span>
                  <span class="_amount_7kgct_501">$10.00</span>
                </div>
                <div class="_content_7kgct_509">
                  <div class="_contentItem_7kgct_517">
                    <span class="_detailLabel_7kgct_523">Tips:</span>
                    <span class="_detailAmount_7kgct_524">$2.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="_section_cmkd9_444">
          <div class="_seatHeader_cmkd9_450">
            <span class="_seatTitle_cmkd9_505">Seat 1</span>
          </div>
          <div class="_dishList_cmkd9_516">
            <div class="_dishItem_99zrf_198" data-testid="pos-ui-dish-item">
              <div class="_sentHeader_99zrf_641"><span class="_sentText_99zrf_652">Sent in 09:33</span></div>
              <div class="_dishMainRow_99zrf_241">
                <div class="_dishInfo_99zrf_205">
                  <section class="_prefix_99zrf_282"><span class="_quantity_99zrf_236">2</span></section>
                  <span class="_dishName_99zrf_333">称重菜</span>
                </div>
                <span class="_dishPrice_99zrf_342">$52.00</span>
              </div>
              <div class="_dishExtras_99zrf_206">
                <div class="_extraItem_99zrf_565">
                  <span class="_extraText_99zrf_402" data-testid="dish-item-unit">2 lbs.</span>
                </div>
              </div>
            </div>
            <div class="_dishItem_99zrf_198" data-testid="pos-ui-dish-item">
              <div class="_sentHeader_99zrf_641"><span class="_sentText_99zrf_652">Sent in 09:35</span></div>
              <div class="_dishMainRow_99zrf_241">
                <div class="_dishInfo_99zrf_205">
                  <section class="_prefix_99zrf_282"><span class="_quantity_99zrf_236">1</span></section>
                  <span class="_dishName_99zrf_333">普通套餐</span>
                </div>
                <span class="_dishPrice_99zrf_342">$123.89</span>
              </div>
              <div class="_comboExtras_99zrf_207">
                <div class="_subItemRow_99zrf_383">
                  <div class="_extraItem_99zrf_565">
                    <span class="_extraText_99zrf_402">common item2</span>
                    <span class="_optionPrice_99zrf_404">$5.89</span>
                  </div>
                </div>
              </div>
              <div class="_comboExtras_99zrf_207">
                <div class="_subItemRow_99zrf_383">
                  <div class="_extraItem_99zrf_565">
                    <span class="_extraText_99zrf_402">普通菜1111</span>
                    <span class="_optionPrice_99zrf_404">$30.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="_container_1jzox_437">
          <div class="_row_1jzox_446">
            <span class="_label_1jzox_483">Count</span>
            <span class="_value_1jzox_484">3</span>
          </div>
          <div class="_row_1jzox_446">
            <span class="_label_1jzox_483">Subtotal</span>
            <span class="_value_1jzox_484">$175.89</span>
          </div>
          <div class="_row_1jzox_446">
            <span class="_label_1jzox_483">Tax</span>
            <span class="_value_1jzox_484">$10.55</span>
          </div>
          <div class="_row_1jzox_446">
            <span class="_label_1jzox_483">Total Before Tips</span>
            <span class="_value_1jzox_484">$186.44</span>
          </div>
          <div class="_row_1jzox_446 _totalRow_1jzox_556">
            <span class="_totalLabel_1jzox_565">Total</span>
            <span class="_totalValue_1jzox_566">$188.44</span>
          </div>
        </div>
      </div>
    </div>

    <script>
      (() => {
        const orderCard = document.querySelector('[data-testid="recall2-order-card-1"]');
        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');

        orderCard?.addEventListener('click', () => {
          dialog.hidden = false;
        });

        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            dialog.hidden = true;
          }
        });
      })();
    </script>
  </body>
</html>
`;

const emptyOrderDetailFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="recall2-header-new-order">New Order</button>
    <button type="button" data-testid="recall2-header-paging">Paging</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderStatus">Order Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderType">Order Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentType">Payment Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-productLine">Product Line</button>
    <button type="button" data-testid="recall2-search-trigger">Search</button>
    <button type="button" data-testid="icon-button-More Filters">More Filters</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="recall2-order-card-2">#2</button>
    </div>

    <div
      role="dialog"
      aria-modal="true"
      data-testid="pos-ui-modal"
      hidden
    >
      <div class="_content_6unfp_324 _modalContent_1l2ju_458">
        <div class="_header_1ej2d_479">
          <div class="_container_1bmdj_453">
            <div class="_orderNumber_1bmdj_459"><span class="_number_1bmdj_480">#2</span></div>
            <div class="_status_1bmdj_494"><span class="_statusTag_1bmdj_500">Unpaid</span></div>
          </div>
          <div class="_actionButtons_gham7_478">
            <button type="button" class="_actionButton_1f1k8_453">Take Out</button>
          </div>
        </div>

        <div class="_section_201h3_462">
          <div class="_header_blu61_457"><h3>CUSTOMER INFO</h3></div>
          <div class="_content_blu61_472"></div>
        </div>

        <div class="_section_201h3_462">
          <div class="_header_blu61_457"><h3>MEMBER INFO</h3></div>
          <div class="_content_blu61_472"></div>
        </div>

        <div class="_section_201h3_462">
          <div class="_header_blu61_457"><h3>PAYMENT</h3></div>
          <div class="_content_blu61_472"></div>
        </div>

        <div class="_container_1jzox_437">
          <div class="_row_1jzox_446">
            <span class="_label_1jzox_483">Total</span>
            <span class="_value_1jzox_484">$0.00</span>
          </div>
        </div>
      </div>
    </div>

    <script>
      (() => {
        const orderCard = document.querySelector('[data-testid="recall2-order-card-2"]');
        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');

        orderCard?.addEventListener('click', () => {
          dialog.hidden = false;
        });

        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            dialog.hidden = true;
          }
        });
      })();
    </script>
  </body>
</html>
`;

const changedSelectorOrderDetailFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="recall2-header-new-order">New Order</button>
    <button type="button" data-testid="recall2-header-paging">Paging</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderStatus">Order Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderType">Order Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentType">Payment Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-productLine">Product Line</button>
    <button type="button" data-testid="recall2-search-trigger">Search</button>
    <button type="button" data-testid="icon-button-More Filters">More Filters</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button">#3</button>
    </div>

    <div role="dialog" aria-modal="true" data-testid="pos-ui-modal" hidden>
      <div class="_header_random_111">
        <div class="_orderNumber_any_222"><span class="_number_any_333">#3</span></div>
        <div class="_status_any_444"><span class="_statusTag_any_555">Paid</span></div>
        <div class="_actionButtons_any_666">
          <button type="button">Dine In</button>
          <button type="button">5(2)</button>
          <button type="button">Alice</button>
        </div>
      </div>

      <div class="_section_new_customer">
        <div><h3>CUSTOMER INFO</h3></div>
        <div>
          <div data-test-id="shared-order-detail-customer-info-open">
            <span class="_customerPrimaryText_new_1">Tester</span>
            <span class="_customerPrimaryText_new_2">(111)222-3333</span>
          </div>
        </div>
      </div>

      <div class="_section_new_payment">
        <div><h3>PAYMENT</h3></div>
        <div>
          <div class="_card_new_437">
            <div class="_paymentType_new_465">
              <span class="_methodLabel_new_492">Cash</span>
              <span class="_amount_new_501">$20.00</span>
            </div>
            <div class="_content_new_509">
              <div class="_contentItem_new_517">
                <span class="_detailLabel_new_523">Tips:</span>
                <span class="_detailAmount_new_524">$1.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section class="_seat_block_changed">
        <div data-test-id="shared-order-seat-dish-list-seat-header-seat-1">
          <span>Seat 1</span>
        </div>
        <div>
          <div data-testid="pos-ui-dish-item">
            <div class="_sentHeader_alt_1"><span>Sent in 10:00</span></div>
            <div class="_mainRow_alt_2">
              <div>
                <span>2</span>
                <span>Spicy Fish</span>
              </div>
              <span>$18.00</span>
            </div>
            <div>
              <div data-testid="dish-item-subitem-combo--1">
                <span>Less Salt</span>
                <span>$0.00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div data-test-id="shared-order-price-summary-toggle" class="_container_new_437">
        <div><span>Count</span><span>2</span></div>
        <div><span>Subtotal</span><span>$18.00</span></div>
        <div><span>Total</span><span>$19.00</span></div>
      </div>
    </div>

    <script>
      (() => {
        const orderCard = document.querySelector('[data-testid="recall2-order-list-container"] button');
        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');
        orderCard?.addEventListener('click', () => {
          dialog.hidden = false;
        });
        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            dialog.hidden = true;
          }
        });
      })();
    </script>
  </body>
</html>
`;

const orderDetailWithOptionsFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="recall2-header-new-order">New Order</button>
    <button type="button" data-testid="recall2-header-paging">Paging</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderStatus">Order Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderType">Order Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentType">Payment Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-productLine">Product Line</button>
    <button type="button" data-testid="recall2-search-trigger">Search</button>
    <button type="button" data-testid="icon-button-More Filters">More Filters</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="recall2-order-card-4">#4</button>
    </div>

    <div role="dialog" aria-modal="true" data-testid="pos-ui-modal" hidden>
      <div class="_header_1ej2d_479">
        <div class="_orderNumber_1bmdj_459"><span class="_number_1bmdj_480">#4</span></div>
        <div class="_status_1bmdj_494"><span class="_statusTag_1bmdj_500">Unpaid</span></div>
        <div class="_actionButtons_gham7_478">
          <button type="button">To Go</button>
          <button type="button">Boss</button>
        </div>
      </div>

      <div data-testid="pos-ui-dish-item" class="_dishItem_yksc5_196">
        <div class="_dishMainRow_yksc5_239">
          <div class="_dishInfo_yksc5_203">
            <section class="_prefix_yksc5_280"><span class="_quantity_yksc5_234">1</span></section>
            <div class="_dishTitleBlock_yksc5_339"><span class="_dishName_yksc5_331">test</span></div>
          </div>
          <span class="_dishPrice_yksc5_355">$7.89</span>
        </div>
        <div class="_comboExtras_yksc5_205">
          <div class="_optionsContainer_yksc5_376">
            <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-67273">
              <div class="_optionItem_yksc5_383">
                <div class="_optionNameContainer_yksc5_541">
                  <span class="_optionName_yksc5_422">Pork Sauce</span>
                </div>
              </div>
            </div>
            <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-67274">
              <div class="_optionItem_yksc5_383">
                <div class="_optionNameContainer_yksc5_541">
                  <span class="_optionName_yksc5_422"> Sweet Sour Sauce</span>
                </div>
              </div>
            </div>
            <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-67275">
              <div class="_optionItem_yksc5_383">
                <div class="_optionNameContainer_yksc5_541">
                  <span class="_optionName_yksc5_422"> Garlic Sauce</span>
                </div>
                <span class="_optionPrice_yksc5_423">$2.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div data-test-id="shared-order-price-summary-toggle" class="_container_new_437">
        <div><span>Count</span><span>1</span></div>
        <div><span>Subtotal</span><span>$7.89</span></div>
        <div><span>Total</span><span>$7.89</span></div>
      </div>
    </div>

    <script>
      (() => {
        const orderCard = document.querySelector('[data-testid="recall2-order-list-container"] button');
        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');
        orderCard?.addEventListener('click', () => {
          dialog.hidden = false;
        });
        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            dialog.hidden = true;
          }
        });
      })();
    </script>
  </body>
</html>
`;

const nestedOptionOrderDetailFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="recall2-header-new-order">New Order</button>
    <button type="button" data-testid="recall2-header-paging">Paging</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderStatus">Order Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderType">Order Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentType">Payment Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-productLine">Product Line</button>
    <button type="button" data-testid="recall2-search-trigger">Search</button>
    <button type="button" data-testid="icon-button-More Filters">More Filters</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="recall2-order-card-5">#5</button>
    </div>

    <div role="dialog" aria-modal="true" data-testid="pos-ui-modal" hidden>
      <div class="_header_1ej2d_479">
        <div class="_orderNumber_1bmdj_459"><span class="_number_1bmdj_480">#5</span></div>
        <div class="_status_1bmdj_494"><span class="_statusTag_1bmdj_500">Unpaid</span></div>
        <div class="_actionButtons_gham7_478">
          <button type="button">To Go</button>
          <button type="button">Boss</button>
        </div>
      </div>

      <div data-testid="pos-ui-dish-item" class="_dishItem_99zrf_198">
        <div class="_dishMainRow_99zrf_241">
          <div class="_dishInfo_99zrf_205">
            <section class="_prefix_99zrf_282"><span class="_quantity_99zrf_236">1</span></section>
            <div class="_dishTitleBlock_99zrf_339"><span class="_dishName_99zrf_331">test</span></div>
          </div>
          <span class="_dishPrice_99zrf_342">$7.89</span>
        </div>
        <div class="_comboExtras_99zrf_207">
          <div class="_optionsContainer_99zrf_376">
            <div class="_optionItemContainer_99zrf_383" data-testid="dish-item-subitem-option-67273">
              <div class="_optionItem_99zrf_383">
                <div class="_optionNameContainer_99zrf_541">
                  <span class="_optionName_99zrf_422">Pork Sauce</span>
                </div>
                <div class="_subItemRow_99zrf_383">
                  <div class="_optionItemContainer_99zrf_383" data-testid="dish-item-subitem-option-67274">
                    <div class="_optionItem_99zrf_383">
                      <div class="_optionNameContainer_99zrf_541">
                        <span class="_optionName_99zrf_422">free suboption</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="_optionItemContainer_99zrf_383" data-testid="dish-item-subitem-option-67275">
              <div class="_optionItem_99zrf_383">
                <div class="_optionNameContainer_99zrf_541">
                  <span class="_optionName_99zrf_422"> Garlic Sauce</span>
                </div>
                <span class="_optionPrice_99zrf_423">$2.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div data-test-id="shared-order-price-summary-toggle" class="_container_new_437">
        <div><span>Count</span><span>1</span></div>
        <div><span>Subtotal</span><span>$7.89</span></div>
        <div><span>Total</span><span>$7.89</span></div>
      </div>
    </div>

    <script>
      (() => {
        const orderCard = document.querySelector('[data-testid="recall2-order-list-container"] button');
        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');
        orderCard?.addEventListener('click', () => {
          dialog.hidden = false;
        });
        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            dialog.hidden = true;
          }
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('Recall 订单详情读取', () => {
  test(
    '应能读取指定订单的详情并在完成后主动关闭详情弹窗',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备包含完整订单详情弹窗的 Recall 页面骨架', async () => {
        await page.setContent(fullOrderDetailFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = '#recall';
        });
      });

      const details = await viewRecallOrderDetails(recallPage, '1');

      expect(details).toEqual({
        orderNumber: '#1',
        paymentStatus: 'Semi-Paid',
        customerInfo: {
          name: '小林林',
          phone: '(934)221-9929',
          address: '611 Jersey Ave, aa, Jersey City, NJ 07302',
          note: 'JGSRJRJRYSGHDRF',
        },
        memberInfo: {
          entries: ['8f1a4d13-8703-4436-b988-b25030bb4f8f', 'VIP Gold'],
        },
        orderContext: {
          orderType: 'Dine In',
          tableName: '3',
          guestCount: '1',
          serverName: 'Boss',
        },
        payments: [
          {
            method: 'Cash',
            amount: '$33.65',
            details: {
              Tips: '$0.00',
              Change: '$0.00',
              'Service Charge': '$1.25',
            },
          },
          {
            method: 'Gift Card',
            amount: '$10.00',
            details: {
              Tips: '$2.00',
            },
          },
        ],
        items: [
          {
            seat: 'Seat 1',
            sentTime: 'Sent in 09:33',
            quantity: '2',
            name: '称重菜',
            price: '$52.00',
            additions: [{ name: '2 lbs.' }],
          },
          {
            seat: 'Seat 1',
            sentTime: 'Sent in 09:35',
            quantity: '1',
            name: '普通套餐',
            price: '$123.89',
            additions: [
              { name: 'common item2', price: '$5.89' },
              { name: '普通菜1111', price: '$30.00' },
            ],
          },
        ],
        priceSummary: {
          Count: 3,
          Subtotal: 175.89,
          Tax: 10.55,
          'Total Before Tips': 186.44,
          Total: 188.44,
        },
      });

      await expect(page.getByRole('dialog')).toBeHidden();
    },
  );

  test(
    '应能在客户会员支付菜品为空时返回空结果并关闭详情弹窗',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备仅包含最小订单详情的 Recall 页面骨架', async () => {
        await page.setContent(emptyOrderDetailFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = '#recall';
        });
      });

      const details = await viewRecallOrderDetails(recallPage, '2');

      expect(details).toEqual({
        orderNumber: '#2',
        paymentStatus: 'Unpaid',
        customerInfo: null,
        memberInfo: null,
        orderContext: {
          orderType: 'Take Out',
          tableName: null,
          guestCount: null,
          serverName: null,
        },
        payments: [],
        items: [],
        priceSummary: {
          Total: 0,
        },
      });

      await expect(page.getByRole('dialog')).toBeHidden();
    },
  );

  test(
    '应能在订单详情选择器换 hash 或改用 data-test-id 后继续读出菜名与价格汇总',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备选择器改版后的订单详情页面骨架', async () => {
        await page.setContent(changedSelectorOrderDetailFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = '#recall';
        });
      });

      const details = await viewRecallOrderDetails(recallPage, '3');

      expect(details).toEqual({
        orderNumber: '#3',
        paymentStatus: 'Paid',
        customerInfo: {
          name: 'Tester',
          phone: '(111)222-3333',
          address: null,
          note: null,
        },
        memberInfo: null,
        orderContext: {
          orderType: 'Dine In',
          tableName: '5',
          guestCount: '2',
          serverName: 'Alice',
        },
        payments: [
          {
            method: 'Cash',
            amount: '$20.00',
            details: {
              Tips: '$1.00',
            },
          },
        ],
        items: [
          {
            seat: 'Seat 1',
            sentTime: 'Sent in 10:00',
            quantity: '2',
            name: 'Spicy Fish',
            price: '$18.00',
            additions: [{ name: 'Less Salt', price: '$0.00' }],
          },
        ],
        priceSummary: {
          Count: 2,
          Subtotal: 18,
          Total: 19,
        },
      });

      await expect(page.getByRole('dialog')).toBeHidden();
    },
  );

  test(
    '应能读取 Recall 菜品下的调味名称和价格',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备带调味子项的 Recall 订单详情', async () => {
        await page.setContent(orderDetailWithOptionsFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = '#recall';
        });
      });

      const details = await viewRecallOrderDetails(recallPage, '4');

      expect(details.items).toEqual([
        {
          additions: [
            { name: 'Pork Sauce' },
            { name: 'Sweet Sour Sauce' },
            { name: 'Garlic Sauce', price: '$2.00' },
          ],
          name: 'test',
          price: '$7.89',
          quantity: '1',
          seat: null,
          sentTime: null,
        },
      ]);
      await expect(page.getByRole('dialog')).toBeHidden();
    },
  );

  test(
    '应能读取 Recall 菜品下的二级调味',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备带二级调味的 Recall 订单详情', async () => {
        await page.setContent(nestedOptionOrderDetailFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = '#recall';
        });
      });

      const details = await viewRecallOrderDetails(recallPage, '5');

      expect(details.items).toEqual([
        {
          additions: [
            {
              name: 'Pork Sauce',
              subAdditions: [{ name: 'free suboption' }],
            },
            { name: 'Garlic Sauce', price: '$2.00' },
          ],
          name: 'test',
          price: '$7.89',
          quantity: '1',
          seat: null,
          sentTime: null,
        },
      ]);
      await expect(page.getByRole('dialog')).toBeHidden();
    },
  );
});
