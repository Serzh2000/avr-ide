/**
  * Мини-заголовок для автотестов редактора: по структуре повторяет CMSIS STM32F1 (периферийные структуры, указатели, маски битов).
  * Написан для тестов, не является заголовком ST.
  */
#ifndef __STM32F1XX_MINI_H
#define __STM32F1XX_MINI_H

#include <stdint.h>

#define __IO volatile

/* ------- карта памяти ------- */
#define PERIPH_BASE           0x40000000UL /*!< Peripheral base address */
#define APB2PERIPH_BASE       (PERIPH_BASE + 0x00010000UL)
#define AHBPERIPH_BASE        (PERIPH_BASE + 0x00020000UL)
#define GPIOA_BASE            (APB2PERIPH_BASE + 0x00000800UL)
#define GPIOC_BASE            (APB2PERIPH_BASE + 0x00001000UL)
#define RCC_BASE              (AHBPERIPH_BASE + 0x00001000UL)

/**
  * @brief General Purpose I/O
  */
typedef struct
{
  __IO uint32_t CRL;   /*!< Port configuration register low,   Address offset: 0x00 */
  __IO uint32_t CRH;   /*!< Port configuration register high,  Address offset: 0x04 */
  __IO uint32_t IDR;   /*!< Port input data register,          Address offset: 0x08 */
  __IO uint32_t ODR;   /*!< Port output data register,         Address offset: 0x0C */
  __IO uint32_t BSRR;  /*!< Port bit set/reset register,       Address offset: 0x10 */
  __IO uint32_t BRR;   /*!< Port bit reset register,           Address offset: 0x14 */
  __IO uint32_t LCKR;  /*!< Port configuration lock register,  Address offset: 0x18 */
} GPIO_TypeDef;

/**
  * @brief Reset and Clock Control
  */
typedef struct
{
  __IO uint32_t CR;       /*!< Clock control register,         Address offset: 0x00 */
  __IO uint32_t CFGR;     /*!< Clock configuration register,   Address offset: 0x04 */
  __IO uint32_t CIR;      /*!< Clock interrupt register,       Address offset: 0x08 */
  __IO uint32_t APB2RSTR; /*!< APB2 peripheral reset register, Address offset: 0x0C */
  __IO uint32_t APB1RSTR; /*!< APB1 peripheral reset register, Address offset: 0x10 */
  __IO uint32_t AHBENR;   /*!< AHB peripheral clock enable,    Address offset: 0x14 */
  __IO uint32_t APB2ENR;  /*!< APB2 peripheral clock enable,   Address offset: 0x18 */
} RCC_TypeDef;

#define GPIOA               ((GPIO_TypeDef *)GPIOA_BASE)
#define GPIOC               ((GPIO_TypeDef *)GPIOC_BASE)
#define RCC                 ((RCC_TypeDef *)RCC_BASE)

/*******************  Bit definition for RCC_APB2ENR register  *****************/
#define RCC_APB2ENR_IOPAEN_Pos  (2U)
#define RCC_APB2ENR_IOPAEN_Msk  (0x1UL << RCC_APB2ENR_IOPAEN_Pos)   /*!< 0x00000004 */
#define RCC_APB2ENR_IOPAEN      RCC_APB2ENR_IOPAEN_Msk              /*!< I/O port A clock enable */
#define RCC_APB2ENR_IOPCEN_Pos  (4U)
#define RCC_APB2ENR_IOPCEN_Msk  (0x1UL << RCC_APB2ENR_IOPCEN_Pos)   /*!< 0x00000010 */
#define RCC_APB2ENR_IOPCEN      RCC_APB2ENR_IOPCEN_Msk              /*!< I/O port C clock enable */

/*******************  Bit definition for GPIO_ODR register  ********************/
#define GPIO_ODR_ODR13_Pos  (13U)
#define GPIO_ODR_ODR13_Msk  (0x1UL << GPIO_ODR_ODR13_Pos)           /*!< 0x00002000 */
#define GPIO_ODR_ODR13      GPIO_ODR_ODR13_Msk                      /*!< Port output data, bit 13 */

#endif /* __STM32F1XX_MINI_H */
