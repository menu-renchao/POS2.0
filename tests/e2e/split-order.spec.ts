import { expect, test } from '@playwright/test';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { SplitOrderPage } from '../../pages/split-order.page';

const splitOrderFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <div role="dialog" aria-modal="true" data-testid="splitPanelModal" class="splitPanelModal">
      <header class="splitPanelModalHeader">
        <h1>Split Order #1001</h1>
      </header>

      <section class="_orderDetailsTotalContainer_1lomb_8">
        <div class="_orderDetailsTotal_1lomb_8">
          <span class="_label_1lomb_17">Total</span>
          <span class="_value_1lomb_35">32.00</span>
        </div>
        <div class="_orderDetailsTotal_1lomb_8" data-testid="remain-summary" hidden>
          <span class="_label_1lomb_17">Remain</span>
          <span class="_remainValue_1lomb_41">32.00</span>
        </div>
      </section>

      <section>
        <div>
          <button type="button" data-testid="evenOrderBtn">Even Order</button>
          <button type="button" data-testid="bySeatsBtn">By Seats</button>
          <button type="button" data-testid="evenItemsBtn" disabled>Even Items</button>
        </div>
        <div>
          <button type="button" data-testid="byAmountBtn">By Amount</button>
          <button type="button" data-testid="combineBtn">Combine</button>
          <button type="button" data-testid="unsplitBtn">Unsplit</button>
          <button type="button" data-testid="moreBtn">More</button>
        </div>
      </section>

      <section class="_modalBody_13a0h_8">
        <div class="_modalContent_13a0h_1">
          <div class="_subordersContainer_13a0h_58" data-testid="suborders-container"></div>
          <button
            type="button"
            class="_addSuborderContainer_1276d_1"
            data-testid="add-amount-suborder"
            hidden
          >
            <span class="_addSuborderText_1276d_6">Add Suborder</span>
          </button>
        </div>
      </section>

      <footer>
        <button type="button" data-testid="split-panel-cancel">Cancel</button>
        <button type="button" data-testid="split-panel-confirm">Confirm</button>
      </footer>
    </div>

    <div role="dialog" aria-modal="true" class="splitInputModalOverlay" hidden>
      <div role="dialog" aria-label="Split Input">
        <h2 data-testid="split-input-title"></h2>
        <input type="text" data-testid="split-input-value" value="" />
        <button type="button" data-testid="split-input-cancel">Cancel</button>
        <button type="button" data-testid="split-input-confirm">Confirm</button>
      </div>
    </div>

    <div role="dialog" aria-modal="true" class="splitCombineModal" hidden>
      <h2>Combine Orders</h2>
      <div class="_orderSummaryContainer_1ylwk_1">
        <div class="_orderSummaryList_1ylwk_8" data-testid="combine-order-list"></div>
      </div>
      <button type="button" data-testid="combine-confirm">Confirm</button>
    </div>

    <script>
      (() => {
        const initialState = {
          byAmount: [],
          mode: 'item',
          remain: 32,
          selectedCombineOrders: [],
          selectedDishId: null,
          selectedEvenDishIds: [],
          suborders: [
            {
              orderNumber: '1001-1',
              paidStatus: null,
              remain: null,
              total: 20,
              seats: [
                {
                  seatName: 'Seat 1',
                  dishes: [
                    { id: 'dish-1', name: 'Fried Rice', proportion: null, paid: false },
                    { id: 'dish-2', name: 'Noodles', proportion: '1/2', paid: false },
                  ],
                },
              ],
            },
            {
              orderNumber: '1001-2',
              paidStatus: null,
              remain: null,
              total: 12,
              seats: [
                {
                  seatName: 'Seat 2',
                  dishes: [{ id: 'dish-3', name: 'Soup', proportion: null, paid: false }],
                },
              ],
            },
            {
              orderNumber: '1001-3',
              paidStatus: 'PAID',
              remain: null,
              total: 0,
              seats: [
                {
                  seatName: 'Seat 3',
                  dishes: [{ id: 'dish-4', name: 'Tea', proportion: null, paid: true }],
                },
              ],
            },
          ],
          submitTarget: 'home',
          total: 32,
        };

        const state = JSON.parse(JSON.stringify(initialState));
        window.__splitOrderState = state;

        const subordersContainer = document.querySelector('[data-testid="suborders-container"]');
        const remainSummary = document.querySelector('[data-testid="remain-summary"]');
        const remainValue = remainSummary.querySelector('._remainValue_1lomb_41');
        const evenItemsButton = document.querySelector('[data-testid="evenItemsBtn"]');
        const amountButton = document.querySelector('[data-testid="byAmountBtn"]');
        const addAmountButton = document.querySelector('[data-testid="add-amount-suborder"]');
        const inputOverlay = document.querySelector('.splitInputModalOverlay');
        const inputTitle = document.querySelector('[data-testid="split-input-title"]');
        const inputValue = document.querySelector('[data-testid="split-input-value"]');
        const combineModal = document.querySelector('.splitCombineModal');
        const combineOrderList = document.querySelector('[data-testid="combine-order-list"]');
        const panelConfirmButton = document.querySelector('[data-testid="split-panel-confirm"]');

        let currentInputAction = '';

        const clone = (value) => JSON.parse(JSON.stringify(value));

        const resetState = () => {
          const next = clone(initialState);
          Object.keys(state).forEach((key) => delete state[key]);
          Object.assign(state, next);
        };

        const computeEvenItemsEnabled = () => {
          const selectedDishes = state.suborders
            .filter((suborder) => suborder.paidStatus !== 'PAID')
            .flatMap((suborder) => suborder.seats)
            .flatMap((seat) => seat.dishes)
            .filter((dish) => state.selectedEvenDishIds.includes(dish.id));

          const eligibleCount = selectedDishes.filter(
            (dish) => !dish.proportion || !/^1\/\d+$/.test(dish.proportion),
          ).length;

          evenItemsButton.disabled = eligibleCount === 0;
        };

        const renderRemain = () => {
          remainSummary.hidden = !(state.mode === 'amount' && state.byAmount.length > 0);
          remainValue.textContent = state.remain.toFixed(2);
          addAmountButton.hidden = state.mode !== 'amount' || state.remain <= 0;
        };

        const renderCombineModal = () => {
          combineOrderList.innerHTML = '';

          for (const suborder of state.suborders) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = '_orderSummary_1reeq_1';
            row.dataset.orderNumber = suborder.orderNumber;
            row.dataset.testid = 'combine-order';
            row.setAttribute(
              'aria-pressed',
              String(state.selectedCombineOrders.includes(suborder.orderNumber)),
            );
            row.innerHTML = [
              '<span class="_orderNumber_1reeq_17">#' + suborder.orderNumber + '</span>',
              '<span class="_totalValue_1reeq_54">' + suborder.total.toFixed(2) + '</span>',
            ].join('');
            row.addEventListener('click', () => {
              const exists = state.selectedCombineOrders.includes(suborder.orderNumber);
              state.selectedCombineOrders = exists
                ? state.selectedCombineOrders.filter((current) => current !== suborder.orderNumber)
                : state.selectedCombineOrders.concat(suborder.orderNumber);
              renderCombineModal();
            });
            combineOrderList.appendChild(row);
          }
        };

        const moveDish = (dishId, targetOrderNumber) => {
          if (!dishId) return;

          let movingDish = null;

          for (const suborder of state.suborders) {
            for (const seat of suborder.seats) {
              const nextDishes = [];

              for (const dish of seat.dishes) {
                if (dish.id === dishId) {
                  movingDish = dish;
                  continue;
                }
                nextDishes.push(dish);
              }

              seat.dishes = nextDishes;
            }
          }

          if (!movingDish) return;

          const targetSuborder = state.suborders.find(
            (suborder) => suborder.orderNumber === targetOrderNumber,
          );

          if (!targetSuborder) return;

          if (targetSuborder.seats.length === 0) {
            targetSuborder.seats.push({ seatName: 'Seat 1', dishes: [] });
          }

          targetSuborder.seats[0].dishes.push(movingDish);
          state.selectedDishId = null;
          render();
        };

        const createDishNode = (suborder, dish) => {
          const dishNode = document.createElement('div');
          dishNode.className = '_dishItem_1bpys_1';
          dishNode.dataset.dishName = dish.name;
          dishNode.dataset.dishId = dish.id;
          dishNode.dataset.orderNumber = suborder.orderNumber;
          dishNode.dataset.testid = 'split-dish';
          dishNode.dataset.proportion = dish.proportion ?? '';

          const mainRow = document.createElement('div');
          mainRow.className = '_dishMainRow_1bpys_36';

          const info = document.createElement('div');
          info.className = '_dishInfo_1bpys_9';

          const prefix = document.createElement('section');
          prefix.className = '_prefix_1bpys_74';

          if (dish.proportion) {
            const proportion = document.createElement('span');
            proportion.className = '_proportion_1bpys_47';
            proportion.textContent = dish.proportion;
            prefix.appendChild(proportion);
          }

          const quantity = document.createElement('span');
          quantity.className = '_quantity_1bpys_101';
          quantity.textContent = '1';
          prefix.appendChild(quantity);

          const name = document.createElement('span');
          name.className = '_dishName_1bpys_119';
          name.textContent = dish.name;
          info.appendChild(prefix);
          info.appendChild(name);
          mainRow.appendChild(info);
          dishNode.appendChild(mainRow);

          dishNode.addEventListener('click', (event) => {
            event.stopPropagation();

            if (state.selectedDishId && state.selectedDishId !== dish.id) {
              moveDish(state.selectedDishId, suborder.orderNumber);
              return;
            }

            state.selectedDishId = dish.id;

            const eligible = !dish.proportion || !/^1\/\d+$/.test(dish.proportion);
            if (eligible && !dish.paid && suborder.paidStatus !== 'PAID') {
              const exists = state.selectedEvenDishIds.includes(dish.id);
              state.selectedEvenDishIds = exists
                ? state.selectedEvenDishIds.filter((current) => current !== dish.id)
                : state.selectedEvenDishIds.concat(dish.id);
            }

            computeEvenItemsEnabled();
          });

          return dishNode;
        };

        const createSuborderNode = (suborder) => {
          const container = document.createElement('div');
          container.className = '_suborderContainer_1ctwn_1';
          container.dataset.orderNumber = suborder.orderNumber;
          container.dataset.testid = 'split-suborder';
          container.dataset.total = suborder.total.toFixed(2);

          const body = document.createElement('section');
          body.className = '_bodyContainer_1ctwn_9';

          const header = document.createElement('header');
          header.className = '_suborderHeader_1ctwn_23';
          header.innerHTML = [
            '<div class="_left_1ctwn_35">',
            '<span class="_orderNumber_1ctwn_40">#' + suborder.orderNumber + '</span>',
            '<div class="_servernameWrapper_1ctwn_49"><div class="_servername_1ctwn_49">Server A</div></div>',
            '</div>',
            '<div class="_right_1ctwn_67"><span class="_totalPrice_1ctwn_75">' +
              suborder.total.toFixed(2) +
              '</span></div>',
          ].join('');
          body.appendChild(header);

          const suborderBody = document.createElement('div');
          suborderBody.className = '_suborderBody_1ctwn_100';
          suborderBody.addEventListener('click', () => moveDish(state.selectedDishId, suborder.orderNumber));

          if (suborder.paidStatus) {
            const paidStatus = document.createElement('section');
            paidStatus.className = '_paidStatusSection_1ctwn_133';
            paidStatus.textContent = suborder.paidStatus;
            suborderBody.appendChild(paidStatus);
          }

          if (suborder.remain !== null) {
            const remain = document.createElement('div');
            remain.className = '_remainValue_1lomb_41';
            remain.textContent = suborder.remain.toFixed(2);
            suborderBody.appendChild(remain);
          }

          for (const seat of suborder.seats) {
            const seatSection = document.createElement('div');
            seatSection.className = '_seatSection_1ctwn_153';

            const dishList = document.createElement('div');
            dishList.className = '_dishList_1ctwn_168';

            const seatHeader = document.createElement('div');
            seatHeader.className = '_seatHeader_1ctwn_165';
            seatHeader.dataset.testid = 'seatHeader-' + seat.seatName;
            seatHeader.textContent = seat.seatName;
            dishList.appendChild(seatHeader);

            for (const dish of seat.dishes) {
              dishList.appendChild(createDishNode(suborder, dish));
            }

            seatSection.appendChild(dishList);
            suborderBody.appendChild(seatSection);
          }

          body.appendChild(suborderBody);
          container.appendChild(body);
          return container;
        };

        const renderSuborders = () => {
          subordersContainer.innerHTML = '';

          for (const suborder of state.suborders) {
            subordersContainer.appendChild(createSuborderNode(suborder));
          }
        };

        const render = () => {
          renderRemain();
          renderSuborders();
          renderCombineModal();
          computeEvenItemsEnabled();
        };

        const openInput = (action, title) => {
          currentInputAction = action;
          inputTitle.textContent = title;
          inputValue.value = '';
          inputOverlay.hidden = false;
        };

        document.querySelector('[data-testid="evenOrderBtn"]').addEventListener('click', () => {
          openInput('evenOrder', 'Even Order');
        });

        evenItemsButton.addEventListener('click', () => {
          if (evenItemsButton.disabled) return;
          openInput('evenItems', 'Even Items');
        });

        amountButton.addEventListener('click', () => {
          state.mode = 'amount';
          openInput('amount', 'By Amount');
        });

        addAmountButton.addEventListener('click', () => {
          openInput('amount', 'By Amount');
        });

        document.querySelector('[data-testid="bySeatsBtn"]').addEventListener('click', () => {
          state.mode = 'item';
          state.suborders = [
            {
              orderNumber: '1001-1',
              paidStatus: null,
              remain: null,
              total: 18,
              seats: [{ seatName: 'Seat 1', dishes: [{ id: 'dish-1', name: 'Fried Rice', proportion: null, paid: false }] }],
            },
            {
              orderNumber: '1001-2',
              paidStatus: null,
              remain: null,
              total: 14,
              seats: [{ seatName: 'Seat 2', dishes: [{ id: 'dish-3', name: 'Soup', proportion: null, paid: false }] }],
            },
          ];
          render();
        });

        document.querySelector('[data-testid="combineBtn"]').addEventListener('click', () => {
          state.selectedCombineOrders = [];
          combineModal.hidden = false;
          renderCombineModal();
        });

        document.querySelector('[data-testid="combine-confirm"]').addEventListener('click', () => {
          if (state.selectedCombineOrders.length >= 2) {
            const baseOrderNumber = state.selectedCombineOrders[0];
            const baseSuborder = state.suborders.find(
              (suborder) => suborder.orderNumber === baseOrderNumber,
            );

            const mergedSuborders = state.suborders.filter((suborder) =>
              state.selectedCombineOrders.includes(suborder.orderNumber),
            );

            const mergedDishes = mergedSuborders.flatMap((suborder) =>
              suborder.seats.flatMap((seat) => seat.dishes),
            );

            baseSuborder.seats = [{ seatName: 'Seat 1', dishes: mergedDishes }];
            baseSuborder.total = mergedSuborders.reduce((sum, suborder) => sum + suborder.total, 0);
            state.suborders = state.suborders.filter(
              (suborder) =>
                suborder.orderNumber === baseOrderNumber ||
                !state.selectedCombineOrders.includes(suborder.orderNumber),
            );
          }

          combineModal.hidden = true;
          render();
        });

        document.querySelector('[data-testid="unsplitBtn"]').addEventListener('click', () => {
          resetState();
          render();
        });

        document.querySelector('[data-testid="split-input-cancel"]').addEventListener('click', () => {
          inputOverlay.hidden = true;
        });

        document.querySelector('[data-testid="split-input-confirm"]').addEventListener('click', () => {
          const numericValue = Number(inputValue.value);
          inputOverlay.hidden = true;

          if (currentInputAction === 'evenOrder') {
            state.mode = 'item';
            state.suborders = Array.from({ length: numericValue }, (_, index) => ({
              orderNumber: '1001-' + (index + 1),
              paidStatus: null,
              remain: null,
              total: Number((state.total / numericValue).toFixed(2)),
              seats: [],
            }));
          }

          if (currentInputAction === 'evenItems') {
            for (const suborder of state.suborders) {
              for (const seat of suborder.seats) {
                for (const dish of seat.dishes) {
                  if (state.selectedEvenDishIds.includes(dish.id)) {
                    dish.proportion = '1/' + numericValue;
                  }
                }
              }
            }
            state.selectedEvenDishIds = [];
          }

          if (currentInputAction === 'amount') {
            state.byAmount.push(numericValue);
            state.remain = Number((state.remain - numericValue).toFixed(2));
            const index = state.byAmount.length;
            state.suborders = state.byAmount.map((amount, amountIndex) => ({
              orderNumber: '1001-' + (amountIndex + 1),
              paidStatus: null,
              remain: Number((state.remain).toFixed(2)),
              total: amount,
              seats: [],
            }));
          }

          render();
        });

        panelConfirmButton.addEventListener('click', () => {
          if (state.submitTarget === 'recall') {
            window.location.hash = '#recall';
            return;
          }

          window.location.hash = '';
        });

        render();
      })();
    </script>
  </body>
</html>
`;

test.describe('分单页面能力契约', () => {
  test(
    '应能完成分单页面读取、按菜品平分、移动菜品、合并与取消分单',
    {},
    async ({ page }) => {
      const splitOrderPage = new SplitOrderPage(page);

      await test.step('准备分单页面契约骨架', async () => {
        await page.setContent(splitOrderFixtureHtml);
      });

      await test.step('校验初始页面与可平分菜品状态', async () => {
        await splitOrderPage.expectLoaded('1001');

        expect(await splitOrderPage.isDishEligibleForEvenSplit('1001-1', 'Fried Rice')).toBe(true);
        expect(await splitOrderPage.isDishEligibleForEvenSplit('1001-1', 'Noodles')).toBe(false);
      });

      await test.step('执行按菜品平分、移动菜品、合并与取消分单', async () => {
        await splitOrderPage.toggleDishSelection('1001-1', 'Fried Rice');
        await splitOrderPage.clickEvenItems();
        await splitOrderPage.fillSplitCount(2);
        await splitOrderPage.confirmSplitInput();

        expect(await splitOrderPage.readDishProportion('1001-1', 'Fried Rice')).toBe('1/2');

        await splitOrderPage.clickDish('1001-1', 'Fried Rice');
        await splitOrderPage.clickDish('1001-2', 'Soup');
        expect(await splitOrderPage.hasDish('1001-2', 'Fried Rice')).toBe(true);

        await splitOrderPage.clickCombine();
        await splitOrderPage.toggleCombineOrder('1001-1');
        await splitOrderPage.toggleCombineOrder('1001-2');
        await splitOrderPage.confirmCombine();

        const mergedSnapshot = await splitOrderPage.readSnapshot();
        expect(mergedSnapshot.suborders).toHaveLength(2);

        await splitOrderPage.clickCancelSplit();

        const resetSnapshot = await splitOrderPage.readSnapshot();
        expect(resetSnapshot.suborders).toHaveLength(3);
        expect(resetSnapshot.suborders[0]?.dishes.some((dish) => dish.name === 'Noodles')).toBe(true);
      });
    },
  );

  test(
    '应能通过 flow 完成平分订单、金额分单与按座位分单',
    {},
    async ({ page }) => {
      const splitOrderPage = new SplitOrderPage(page);
      const splitOrderFlow = new SplitOrderFlow();

      await test.step('准备分单页面契约骨架', async () => {
        await page.setContent(splitOrderFixtureHtml);
      });

      await test.step('执行平分订单', async () => {
        await splitOrderFlow.splitOrderEvenly(splitOrderPage, 4);
        expect((await splitOrderPage.readSnapshot()).suborders).toHaveLength(4);
      });

      await test.step('恢复初始状态后执行按金额分单', async () => {
        await splitOrderPage.clickCancelSplit();
        await splitOrderFlow.splitOrderByAmounts(splitOrderPage, [10, 5]);

        const amountSnapshot = await splitOrderPage.readSnapshot();
        expect(amountSnapshot.remain).toBe('17.00');
        expect(amountSnapshot.suborders.map((suborder) => suborder.total)).toEqual([
          '10.00',
          '5.00',
        ]);
      });

      await test.step('恢复初始状态后执行按座位分单', async () => {
        await splitOrderPage.clickCancelSplit();
        await splitOrderFlow.splitOrderBySeats(splitOrderPage);

        const seatSnapshot = await splitOrderPage.readSnapshot();
        expect(seatSnapshot.suborders).toHaveLength(2);
        expect(seatSnapshot.suborders.map((suborder) => suborder.seats[0])).toEqual([
          'Seat 1',
          'Seat 2',
        ]);
      });
    },
  );

  test(
    '应能在提交后根据当前地址返回对应页面对象',
    {},
    async ({ page }) => {
      const splitOrderPage = new SplitOrderPage(page);
      const splitOrderFlow = new SplitOrderFlow();

      await test.step('准备分单页面契约骨架并提交回 Recall', async () => {
        await page.setContent(splitOrderFixtureHtml);
        await page.evaluate(() => {
          window.__splitOrderState.submitTarget = 'recall';
        });

        const recallPage = await splitOrderFlow.submitAndReturnPage(splitOrderPage);
        expect(recallPage.constructor.name).toBe('RecallPage');
      });

      await test.step('重新准备页面并提交回主页', async () => {
        await page.setContent(splitOrderFixtureHtml);
        await page.evaluate(() => {
          window.__splitOrderState.submitTarget = 'home';
        });

        const homePage = await splitOrderFlow.submitAndReturnPage(splitOrderPage);
        expect(homePage.constructor.name).toBe('HomePage');
      });
    },
  );
});
