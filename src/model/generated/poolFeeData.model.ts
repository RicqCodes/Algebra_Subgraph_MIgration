import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class PoolFeeData {
    constructor(props?: Partial<PoolFeeData>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: true})
    pool!: string | undefined | null

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    timestamp!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    fee!: bigint
}
