// СГЕНЕРИРОВАНО scripts/build-cmsis-manifest.mjs — не править вручную.
// Файлы CMSIS из первоисточников ST (Apache-2.0): адрес = неизменяемый коммит тега, проверка = git-SHA-1 содержимого (blob).
export interface SupportFile { path: string; size: number; sha1: string }
export interface SupportSet { repo: string; tag: string; commit: string; files: SupportFile[] }
export const SUPPORT_DEVICES: Record<string, SupportSet> = {
 "cmsis-device-f1": {
  "repo": "cmsis-device-f1",
  "tag": "v4.3.5",
  "commit": "8a76309ed1250d817e9c888c4417171d2ba3ba63",
  "files": [
   {
    "path": "Include/stm32f103xb.h",
    "size": 842883,
    "sha1": "82df4b00ab785323b004838664d90dc868b70eb1"
   },
   {
    "path": "Include/stm32f1xx.h",
    "size": 10110,
    "sha1": "0f32778fef45a006ad2aded658a4cfcca1f32e7b"
   },
   {
    "path": "Include/system_stm32f1xx.h",
    "size": 1758,
    "sha1": "f8c5304cc509b67b46215ad2f15a7f46ee4e7434"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32f103xb.s",
    "size": 9725,
    "sha1": "76142851d4e7d7b3941afffd677492770418048a"
   },
   {
    "path": "Source/Templates/system_stm32f1xx.c",
    "size": 14575,
    "sha1": "3afa78dbdda1fc9167b401fb71e9d94bc4ee3e72"
   },
   {
    "path": "License.md",
    "size": 11357,
    "sha1": "7733a496798048b4339d794446c8543be67a49ac"
   }
  ]
 },
 "cmsis-device-f4": {
  "repo": "cmsis-device-f4",
  "tag": "v2.6.12",
  "commit": "8c79dcf2f1d866d139a5d66240083ae6194b6dd1",
  "files": [
   {
    "path": "Include/stm32f401xe.h",
    "size": 644555,
    "sha1": "32eee1b1062659173d16ddff0c83e35c6fce4be1"
   },
   {
    "path": "Include/stm32f407xx.h",
    "size": 1194277,
    "sha1": "9fb556088359b572705dfe794513915ac1a6e9ff"
   },
   {
    "path": "Include/stm32f411xe.h",
    "size": 647724,
    "sha1": "9a686069b20b9824d2adc2492fb836d08de0bc45"
   },
   {
    "path": "Include/stm32f446xx.h",
    "size": 1216483,
    "sha1": "ea8414c3259155d5f2138319d3e309fa9fa84337"
   },
   {
    "path": "Include/stm32f4xx.h",
    "size": 11928,
    "sha1": "5bfe6edec86f1c7431135abb569846be6bd92706"
   },
   {
    "path": "Include/system_stm32f4xx.h",
    "size": 2214,
    "sha1": "15208a55650c6b8085f9b4e42cc603736420b6cd"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32f401xe.s",
    "size": 20084,
    "sha1": "b5f41109e1ed613aa3934630df0ffa3a66c57d41"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32f407xx.s",
    "size": 22858,
    "sha1": "cc5f27edff1e3fc4aef15162efb491720760ae9e"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32f411xe.s",
    "size": 20260,
    "sha1": "1c1f70df173a5b5f4ab3711838fdfd50ca51b110"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32f446xx.s",
    "size": 24403,
    "sha1": "7040eafaff31d6b337fb7fead968d330638b4dde"
   },
   {
    "path": "Source/Templates/system_stm32f4xx.c",
    "size": 26374,
    "sha1": "96968289ccda8a2a2d15501a17f3bbc7da3d3464"
   },
   {
    "path": "LICENSE.md",
    "size": 9756,
    "sha1": "72fbf79ee22375bf092d8dc4bd7712ba32c8a61a"
   }
  ]
 },
 "cmsis-device-f3": {
  "repo": "cmsis-device-f3",
  "tag": "v2.3.9",
  "commit": "402c039a0a6d73c31303a05e6a1d6b8b59474fa1",
  "files": [
   {
    "path": "Include/stm32f303xe.h",
    "size": 1302646,
    "sha1": "deaabee1d0c658a07434733cadbc0879cb3bd762"
   },
   {
    "path": "Include/stm32f3xx.h",
    "size": 10517,
    "sha1": "e2e3ee1e2066ae13f77d7a0442df784005ee911a"
   },
   {
    "path": "Include/system_stm32f3xx.h",
    "size": 2280,
    "sha1": "454a3028d65d8708491156167282dd3fc1140b8a"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32f303xe.s",
    "size": 12901,
    "sha1": "554d3ab087ab46b2456dc1cbc8041b224eb2ff44"
   },
   {
    "path": "Source/Templates/system_stm32f3xx.c",
    "size": 10663,
    "sha1": "4b1654f8da79597463a4aaaaf2aa6414b613dc35"
   },
   {
    "path": "LICENSE.md",
    "size": 11347,
    "sha1": "a6aa17f2cfcc8ba10ff1276b6f8de7b633a04162"
   }
  ]
 },
 "cmsis-device-g4": {
  "repo": "cmsis-device-g4",
  "tag": "v1.2.6",
  "commit": "25664ddc3a7624ae9627ae8c4c672073dc5b2539",
  "files": [
   {
    "path": "Include/stm32g431xx.h",
    "size": 989465,
    "sha1": "e1794444a40b55c7717ff8483d7946ba3d18a11b"
   },
   {
    "path": "Include/stm32g474xx.h",
    "size": 1392046,
    "sha1": "e78fee6f57287c87634570c3c649821635b1c6ea"
   },
   {
    "path": "Include/stm32g4xx.h",
    "size": 8920,
    "sha1": "2535cc2136f4a15d16557e4c6e233634f59a46ae"
   },
   {
    "path": "Include/system_stm32g4xx.h",
    "size": 2252,
    "sha1": "ed341a8ef6b3428a8e8fe4b2292704975c44a245"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32g431xx.s",
    "size": 12523,
    "sha1": "8c5923701b18f9a58d65e09228b4bd2d91f80bcf"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32g474xx.s",
    "size": 15535,
    "sha1": "e7a2c61fcd8d47e8812ea30c3951d9c88ba9e5f7"
   },
   {
    "path": "Source/Templates/system_stm32g4xx.c",
    "size": 10446,
    "sha1": "2cd914e7b9352928c0f0b7dbe9f46f75339d86c1"
   },
   {
    "path": "LICENSE.md",
    "size": 9753,
    "sha1": "48dcd966857822ffc6505ae1fcf3a80bc56abd69"
   }
  ]
 },
 "cmsis-device-l4": {
  "repo": "cmsis-device-l4",
  "tag": "v1.7.5",
  "commit": "dc04e41afbd7c204cd09f2fa5dd29658efbaff6c",
  "files": [
   {
    "path": "Include/stm32l476xx.h",
    "size": 1411712,
    "sha1": "c5950386a61c4b3d506f677266c3a9efb22791fd"
   },
   {
    "path": "Include/stm32l4xx.h",
    "size": 10546,
    "sha1": "a1a0b3180a874c04868cabe6f91689dc496741a7"
   },
   {
    "path": "Include/system_stm32l4xx.h",
    "size": 2333,
    "sha1": "957a3642f6ba0d04c10bb10db804a010d3e1a777"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32l476xx.s",
    "size": 13353,
    "sha1": "45b6e066d70b31124011701ddb6ccb688ca540f8"
   },
   {
    "path": "Source/Templates/system_stm32l4xx.c",
    "size": 12538,
    "sha1": "a70a6be8542baf03bbb61b1775c847aa64a3728f"
   },
   {
    "path": "LICENSE.md",
    "size": 9757,
    "sha1": "e0d829b638a76e28b99b1d39eeaa7823e720b8d9"
   }
  ]
 },
 "cmsis-device-l0": {
  "repo": "cmsis-device-l0",
  "tag": "v1.9.4",
  "commit": "7b7ae8cd71437331e1d7824f157d00c7bb4a5044",
  "files": [
   {
    "path": "Include/stm32l053xx.h",
    "size": 581064,
    "sha1": "c746e87a4e95d4031eb552cd45ffff2248862902"
   },
   {
    "path": "Include/stm32l0xx.h",
    "size": 11585,
    "sha1": "9fb4154c09c59bb784d5f1ca8821808a2836eab0"
   },
   {
    "path": "Include/system_stm32l0xx.h",
    "size": 2327,
    "sha1": "90977249b62ef08d4b174f7f9e905e656fea9dba"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32l053xx.s",
    "size": 9278,
    "sha1": "704dc45c2d2dcd69d70e277f7f6d6ca23dd09c11"
   },
   {
    "path": "Source/Templates/system_stm32l0xx.c",
    "size": 8937,
    "sha1": "d87a7480e757d0c75384c57081761871c145924a"
   },
   {
    "path": "LICENSE.md",
    "size": 9757,
    "sha1": "e0d829b638a76e28b99b1d39eeaa7823e720b8d9"
   }
  ]
 },
 "cmsis-device-l1": {
  "repo": "cmsis-device-l1",
  "tag": "v2.3.4",
  "commit": "69ed99e32827a72ea9594c081fb3efc7d47ef723",
  "files": [
   {
    "path": "Include/stm32l152xe.h",
    "size": 733547,
    "sha1": "dbe7432fb174dd633381786e006221c8c1864689"
   },
   {
    "path": "Include/stm32l1xx.h",
    "size": 11111,
    "sha1": "5be3e3e06024491f03cee3f557f4e2b524b53a56"
   },
   {
    "path": "Include/system_stm32l1xx.h",
    "size": 2330,
    "sha1": "a5d17336707bae215794ed5ecfe143e5589f5f66"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32l152xe.s",
    "size": 10902,
    "sha1": "d3dd841ecf59e82ee213d7a203d3c304e771b85a"
   },
   {
    "path": "Source/Templates/system_stm32l1xx.c",
    "size": 15673,
    "sha1": "093a38b8688af43c69439cb7da7633c052b58ccd"
   },
   {
    "path": "License.md",
    "size": 11357,
    "sha1": "261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64"
   }
  ]
 },
 "cmsis-device-f0": {
  "repo": "cmsis-device-f0",
  "tag": "v2.3.8",
  "commit": "f6fbbfcdc80797779a7a1eec87f1002516ef0483",
  "files": [
   {
    "path": "Include/stm32f030x6.h",
    "size": 384485,
    "sha1": "22943c462a6987f749618b769b2876e1865bf9d7"
   },
   {
    "path": "Include/stm32f0xx.h",
    "size": 10992,
    "sha1": "a6627297b19a999a7e498857a0fce2a2121ac814"
   },
   {
    "path": "Include/system_stm32f0xx.h",
    "size": 2201,
    "sha1": "b662b64cb65b20320d5a6320ce4581db0f15b3cd"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32f030x6.s",
    "size": 8560,
    "sha1": "9f89ad985d6e469b2409f2fdff9be6e56f630b6b"
   },
   {
    "path": "Source/Templates/system_stm32f0xx.c",
    "size": 9249,
    "sha1": "fb0bdc82cca906642b1c5349a4d2a1d9e9e41580"
   },
   {
    "path": "LICENSE.md",
    "size": 9756,
    "sha1": "72fbf79ee22375bf092d8dc4bd7712ba32c8a61a"
   }
  ]
 },
 "cmsis-device-h7": {
  "repo": "cmsis-device-h7",
  "tag": "v1.10.8",
  "commit": "277b283ad9ab79ea85ee42920e371b019d7defb0",
  "files": [
   {
    "path": "Include/stm32h743xx.h",
    "size": 2098465,
    "sha1": "7d574329ea6542aa64ccd0a4ec81fe292612fe6f"
   },
   {
    "path": "Include/stm32h7xx.h",
    "size": 11834,
    "sha1": "3227420b9cf85609e7dc26e2b8d4aa9474687a19"
   },
   {
    "path": "Include/system_stm32h7xx.h",
    "size": 2445,
    "sha1": "2ae989bf16f957eccf78dc099911e0d0c797d2e1"
   },
   {
    "path": "Source/Templates/gcc/startup_stm32h743xx.s",
    "size": 29344,
    "sha1": "145635469c299e6381cc976b2092c946e7fe274d"
   },
   {
    "path": "Source/Templates/system_stm32h7xx.c",
    "size": 20261,
    "sha1": "a89bea5c8add02a60204091645ed3dca32f3b44e"
   },
   {
    "path": "LICENSE.md",
    "size": 11347,
    "sha1": "a6aa17f2cfcc8ba10ff1276b6f8de7b633a04162"
   }
  ]
 }
}
export const SUPPORT_CORES: Record<string, SupportSet> = {
 "cortex-m3": {
  "repo": "cmsis_core",
  "tag": "v5.6.0_cm3",
  "commit": "f37cfcee997e714b0fad374a328c41df64f99acb",
  "files": [
   {
    "path": "Core/Include/cmsis_compiler.h",
    "size": 9481,
    "sha1": "adbf296f15a47a93e5058abddad6742bb4b9854d"
   },
   {
    "path": "Core/Include/cmsis_gcc.h",
    "size": 62627,
    "sha1": "3ddcc58b69f6a8d60f614df45fb98932b07ac9c2"
   },
   {
    "path": "Core/Include/cmsis_version.h",
    "size": 1676,
    "sha1": "f2e2746626afefeebcc3435ef433895b5bcc4cdb"
   },
   {
    "path": "Core/Include/core_cm3.h",
    "size": 109420,
    "sha1": "8157ca782da2c1d0515ec4be7252534f039ce562"
   },
   {
    "path": "Core/Include/mpu_armv7.h",
    "size": 11690,
    "sha1": "66ef59b4a0bff6e7f2d077cbaa235b55f5e1bfb2"
   }
  ]
 },
 "cortex-m4": {
  "repo": "cmsis_core",
  "tag": "v5.6.0_cm4",
  "commit": "be0e91fb4ba19a2ee427ba8b6b75b43eb02b2810",
  "files": [
   {
    "path": "Core/Include/cmsis_compiler.h",
    "size": 9481,
    "sha1": "adbf296f15a47a93e5058abddad6742bb4b9854d"
   },
   {
    "path": "Core/Include/cmsis_gcc.h",
    "size": 62627,
    "sha1": "3ddcc58b69f6a8d60f614df45fb98932b07ac9c2"
   },
   {
    "path": "Core/Include/cmsis_version.h",
    "size": 1676,
    "sha1": "f2e2746626afefeebcc3435ef433895b5bcc4cdb"
   },
   {
    "path": "Core/Include/core_cm4.h",
    "size": 120867,
    "sha1": "12c023b8017d9f712b2bdad1f27a0308310e14ba"
   },
   {
    "path": "Core/Include/mpu_armv7.h",
    "size": 11690,
    "sha1": "66ef59b4a0bff6e7f2d077cbaa235b55f5e1bfb2"
   },
   {
    "path": "LICENSE.txt",
    "size": 11357,
    "sha1": "8dada3edaf50dbc082c9a125058f25def75e625a"
   }
  ]
 },
 "cortex-m0plus": {
  "repo": "cmsis_core",
  "tag": "v5.6.0_cm0",
  "commit": "94a458d05c9929e20ebd428259b6c80b64a173e7",
  "files": [
   {
    "path": "Core/Include/cmsis_compiler.h",
    "size": 9481,
    "sha1": "adbf296f15a47a93e5058abddad6742bb4b9854d"
   },
   {
    "path": "Core/Include/cmsis_gcc.h",
    "size": 62627,
    "sha1": "3ddcc58b69f6a8d60f614df45fb98932b07ac9c2"
   },
   {
    "path": "Core/Include/cmsis_version.h",
    "size": 1676,
    "sha1": "f2e2746626afefeebcc3435ef433895b5bcc4cdb"
   },
   {
    "path": "Core/Include/core_cm0plus.h",
    "size": 49524,
    "sha1": "d104965db5198d5b45737d48abb3981fc1936ba2"
   },
   {
    "path": "LICENSE.txt",
    "size": 11357,
    "sha1": "8dada3edaf50dbc082c9a125058f25def75e625a"
   }
  ]
 },
 "cortex-m0": {
  "repo": "cmsis_core",
  "tag": "v5.6.0_cm0",
  "commit": "94a458d05c9929e20ebd428259b6c80b64a173e7",
  "files": [
   {
    "path": "Core/Include/cmsis_compiler.h",
    "size": 9481,
    "sha1": "adbf296f15a47a93e5058abddad6742bb4b9854d"
   },
   {
    "path": "Core/Include/cmsis_gcc.h",
    "size": 62627,
    "sha1": "3ddcc58b69f6a8d60f614df45fb98932b07ac9c2"
   },
   {
    "path": "Core/Include/cmsis_version.h",
    "size": 1676,
    "sha1": "f2e2746626afefeebcc3435ef433895b5bcc4cdb"
   },
   {
    "path": "Core/Include/core_cm0.h",
    "size": 41430,
    "sha1": "cafae5a0a73644129a486644044b54eedee18d11"
   },
   {
    "path": "LICENSE.txt",
    "size": 11357,
    "sha1": "8dada3edaf50dbc082c9a125058f25def75e625a"
   }
  ]
 },
 "cortex-m7": {
  "repo": "cmsis_core",
  "tag": "v5.6.0_cm7",
  "commit": "04fe7bb2025811f10848ce14be810dde981934cf",
  "files": [
   {
    "path": "Core/Include/cmsis_compiler.h",
    "size": 9481,
    "sha1": "adbf296f15a47a93e5058abddad6742bb4b9854d"
   },
   {
    "path": "Core/Include/cmsis_gcc.h",
    "size": 62627,
    "sha1": "3ddcc58b69f6a8d60f614df45fb98932b07ac9c2"
   },
   {
    "path": "Core/Include/cmsis_version.h",
    "size": 1676,
    "sha1": "f2e2746626afefeebcc3435ef433895b5bcc4cdb"
   },
   {
    "path": "Core/Include/core_cm7.h",
    "size": 149036,
    "sha1": "c4515d8fa3196e587d820b521c27c30c580010c3"
   },
   {
    "path": "Core/Include/mpu_armv7.h",
    "size": 11690,
    "sha1": "66ef59b4a0bff6e7f2d077cbaa235b55f5e1bfb2"
   },
   {
    "path": "LICENSE.txt",
    "size": 11357,
    "sha1": "8dada3edaf50dbc082c9a125058f25def75e625a"
   }
  ]
 }
}
